'use strict'
const bareInspector = require('bare-inspector')
const { Inspector } = require('pear-inspect')
const path = require('bare-path')
const os = require('bare-os')
const ReadyResource = require('ready-resource')
const Hyperswarm = require('hyperswarm')
const Iambus = require('iambus')
const safetyCatch = require('safety-catch')
const PearRuntimeUpdater = require('pear-runtime-updater')
const IPC = require('pear-ipc')
const { isWindows } = require('which-runtime')
const plink = require('pear-link')
const {
  SOCKET_PATH,
  CHECKOUT,
  SPINDOWN_TIMEOUT,
  WAKEUP,
  KNOWN_NODES_LIMIT
} = require('pear-constants')
const Replicator = require('./lib/replicator')
const HyperDB = require('hyperdb')
const hyperdb = require('./lib/model')
const db = require('./lib/db')
const registerUrlHandler = require('../../url-handler')
const { version, productName, upgrade } = require('../../package.json')
const State = require('./state')
const ops = {
  GC: require('./ops/gc'),
  Stage: require('./ops/stage'),
  Seed: require('./ops/seed'),
  Provision: require('./ops/provision'),
  Release: require('./ops/release'),
  Dump: require('./ops/dump'),
  Info: require('./ops/info'),
  Touch: require('./ops/touch'),
  Data: require('./ops/data'),
  Presets: require('./ops/presets'),
  Multisig: require('./ops/multisig')
}

// ensure that we are registered as a link handler
registerUrlHandler(WAKEUP)

const SWARM_DELAY = 5000
const CHECKMARK = isWindows ? '^' : '✔'

class Sidecar extends ReadyResource {
  static Updater = PearRuntimeUpdater

  spindownt = null
  spindownms = SPINDOWN_TIMEOUT
  decomissioned = false
  swarm = null
  keyPair = null

  teardown() {
    global.Bare.exit()
  }

  constructor({ updater, corestore, nodes }) {
    super()

    const rocks = HyperDB.rocks(corestore.storage.rocks.session(), hyperdb.spec)
    this.model = new hyperdb.Model(rocks)

    const rocksNext = HyperDB.rocks(
      path.join(path.dirname(path.dirname(corestore.storage.path)), 'db'),
      db.spec
    )
    this.db = {
      model: new db.Model(rocksNext)
    }

    const all = {}

    this.bus = new Iambus()

    this.bus.sub(all).on('data', (msg) => {
      LOG.trace('bus', 'PUB', msg)
    })

    this.version = CHECKOUT

    this.updater = updater
    if (this.updater) this.#bindUpdaterEvents(updater)

    this.#spindownCountdown()

    this.corestore = corestore
    this.nodes = nodes
    this.ipc = new IPC.Server({
      handlers: this,
      socketPath: SOCKET_PATH
    })

    this.ipc.on('client', (client) => {
      client.once('close', () => {
        if (client.clock <= 0) {
          LOG.info(
            'sidecar',
            'Unresponsive non-app process detected with closed client id ' + client.id
          )
          return
        }
        this.#spindownCountdown()
      })
    })

    this.replicator = updater ? new Replicator(updater.drive) : null

    this.running = new Map()

    this._inspector = new Inspector({
      inspector: bareInspector,
      bootstrap: this.nodes
    })

    this.lazySwarmTimeout = setTimeout(() => {
      // We defer the ready incase the sidecar is immediately killed afterwards
      if (this.closed) return
      this.ready().catch((err) => LOG.error('internal', 'Failed to Open Sidecar', err))
    }, SWARM_DELAY)
    global.sidecar = this
  }

  async _open() {
    await this.model.db.ready()
    await this.db.model.ready()
    await this.#ensureSwarm()
    LOG.info('sidecar', '- Sidecar Booted')
    const gcCycle = async () => {
      await this.model.gc()
    }
    gcCycle().catch((err) => LOG.error('sidecar', 'GC error', err))
    const gcCycleMs = 10 * 60 * 1000 // 10 minutes
    this.gcInterval = setInterval(() => {
      gcCycle().catch((err) => LOG.error('sidecar', 'GC error', err))
    }, gcCycleMs)
  }

  get clients() {
    return this.ipc.clients
  }

  get hasClients() {
    return this.ipc?.hasClients || false
  }

  #spindownCountdown() {
    clearTimeout(this.spindownt)
    if (this.decomissioned) return
    if (this.hasClients) return
    this.spindownt = setTimeout(() => {
      if (this.hasClients || this.updater?.updating) return
      this.close().catch((err) => {
        LOG.error('internal', 'Failed to Close Sidecar', err)
      })
    }, this.spindownms)
  }

  async updateNotify(version, info = {}) {
    if (version.force)
      LOG.info('sidecar', 'Platform Force update (' + version.force.reason + '). Updating to:')
    else LOG.info('sidecar', 'Platform update available. Restart to update to:')

    if (version.key === null) LOG.info('sidecar', ` ${info.link}`)
    else LOG.info('sidecar', ' ' + plink.serialize({ drive: version }))

    if (!info.link) this.spindownms = 0
    this.#spindownCountdown()
  }

  stage(params, client) {
    return new ops.Stage(params, client, this)
  }

  seed(params, client) {
    return new ops.Seed(params, client, this)
  }

  provision(params, client) {
    return new ops.Provision(params, client, this)
  }

  release(params, client) {
    return new ops.Release(params, client, this)
  }

  dump(params, client) {
    return new ops.Dump(params, client, this)
  }

  info(params, client) {
    return new ops.Info(params, client, this)
  }

  data(params, client) {
    return new ops.Data(params, client, this)
  }

  gc(params, client) {
    return new ops.GC(params, client, this)
  }

  touch(params, client) {
    return new ops.Touch(params, client, this)
  }

  versions(params, client) {
    const runtimes = { bare: Bare.versions.bare, pear: version }
    return {
      platform: this.version,
      runtimes
    }
  }

  presets(params, client) {
    return new ops.Presets(params, client, this)
  }

  multisig(params, client) {
    return new ops.Multisig(params, client, this)
  }

  shutdown(params, client) {
    return this.#shutdown(client)
  }

  inspect(params, client) {
    if (!this._inspector.dht) {
      return this._inspector.enable()
    } else {
      return this._inspector.inspectorKey
    }
  }

  #endRPCStreams(client) {
    // TODO: instead of client._rpc collect src and dst streams in sidecar, do push(null) on src stream, listen for close on dst stream
    const streams = client._rpc._handlers
      .flatMap((m) => m?._streams)
      .filter((m) => m?.destroyed === false)
    return Promise.all(
      streams.map(
        (stream) =>
          new Promise((resolve) => {
            stream.once('close', resolve)
            stream.end()
          })
      )
    )
  }

  closeClients(params = {}, originClient) {
    if (this.hasClients === false) return []
    const metadata = []

    for (const client of this.clients.toSorted((a, b) => b.at - a.at)) {
      if (client === originClient) continue

      if (client.userData?.state && !client.userData.state.parent) {
        const { id, cmdArgs, cwd, dir, env, options } = client.userData.state
        metadata.push({ id, cmdArgs, cwd, dir, env, options })
      }

      this.#endRPCStreams(client).then(() => client.close())
    }

    return metadata
  }

  async #ensureSwarm() {
    try {
      await this.corestore.ready()
    } catch (err) {
      err.code = 'ERR_OPEN'
      throw err
    }
    this.keyPair = await this.corestore.createKeyPair('holepunch')
    if (this.nodes) LOG.info('sidecar', 'DHT bootstrap set', this.nodes)
    const knownNodes = await this.db.model.getDhtNodes()
    const nodes = this.nodes ? undefined : knownNodes
    if (nodes) {
      LOG.info('dht', '- DHT known-nodes read from database ' + nodes.length + ' nodes')
      LOG.trace('dht', nodes.map((node) => `  - ${node.host}:${node.port}`).join('\n'))
    }
    this.swarm = new Hyperswarm({
      keyPair: this.keyPair,
      bootstrap: this.nodes,
      nodes
    })
    this.swarm.once('close', () => {
      this.swarm = null
    })
    this.swarm.on('connection', (connection) => {
      this.corestore.replicate(connection)
    })
    if (this.replicator !== null) {
      this.replicator.join(this.swarm, { server: false, client: true }).catch(safetyCatch)
    }
  }

  getCorestore(opts) {
    return this.corestore.session({ writable: false, ...opts })
  }

  async #shutdown(client) {
    LOG.info('sidecar', '- Sidecar Shutting Down...')
    await this.#endRPCStreams(client).then(() => client.close())
    this.spindownms = 0
    this.closeClients()
    this.#spindownCountdown()
    await this.closing
  }

  async #close() {
    clearInterval(this.gcInterval)
    clearTimeout(this.lazySwarmTimeout)
    if (this.replicator) await this.replicator.leave(this.swarm)
    if (this.swarm) {
      if (!this.nodes) {
        const knownNodes = this.swarm.dht.toArray({ limit: KNOWN_NODES_LIMIT })
        if (knownNodes.length) {
          await this.db.model.setDhtNodes(knownNodes)
          LOG.info('dht', '- DHT known-nodes wrote to database ' + knownNodes.length + ' nodes')
          LOG.trace('dht', knownNodes.map((node) => `  - ${node.host}:${node.port}`).join('\n'))
        }
      }
      await this.swarm.destroy()
    }
    await this.model.close()
    await this.db.model.close()
    if (this.corestore) await this.corestore.close()
    LOG.info('sidecar', CHECKMARK + ' Sidecar Closed')
  }

  #bindUpdaterEvents(updater) {
    updater.on('updating', () => {
      const key = updater.key
      const length = updater.drive.core.length
      LOG.info(
        'sidecar',
        key === version.key
          ? `- Updating to length ${length}...`
          : `- Switching to key ${key} with length ${length}...`
      )
    })

    updater.on('updated', () => this.updateNotify({ key: updater.key, length: updater.length }))

    updater.on('error', (err) => {
      LOG.error('sidecar', 'Updater error', err)
    })
  }

  async _close() {
    if (this.decomissioned) return
    this.decomissioned = true
    await this._inspector.disable()
    for (const client of this.clients.toSorted((a, b) => b.at - a.at)) {
      // TODO: can teardown be respected here?
      await this.#endRPCStreams(client)
    }
    // point of no return, death-march ensues
    this.deathClock()
    const closing = this.#close()
    this.closeClients()
    await closing
    await this.ipc.close()

    if (this.updater) {
      await this.updater.applyUpdate()
      LOG.info('sidecar', CHECKMARK + ' Applied update')
      await this.updater.close()
    }
    this.bus.destroy()
  }

  deathClock(ms = 20000) {
    clearTimeout(this.bailout)
    this.bailout = setTimeout(async () => {
      if (this.updater) {
        try {
          await this.updater.applyUpdate()
          LOG.info('sidecar', LOG.CHECKMARK + ' Applied update')
        } catch (err) {
          LOG.error('sidecar', err)
        }
      }

      // terminate any remaining unresponsive processes
      for (const app of this.apps) {
        if (!app.pid) continue
        LOG.info('sidecar', `Killing unresponsive process with PID ${app.pid}`)
        os.kill(app.pid, 'SIGKILL')
      }

      LOG.error('internal', 'DEATH CLOCK TRIGGERED, FORCE KILLING. EXIT CODE 124')
      Bare.exit(124) // timeout
    }, ms).unref()
  }
}

module.exports = Sidecar
