'use strict'
const bareInspector = require('bare-inspector')
const { Inspector } = require('pear-inspect')
const fs = require('bare-fs')
const path = require('bare-path')
const os = require('bare-os')
const daemon = require('bare-daemon')
const ReadyResource = require('ready-resource')
const ScriptLinker = require('script-linker')
const Hyperswarm = require('hyperswarm')
const hypercoreid = require('hypercore-id-encoding')
const crypto = require('hypercore-crypto')
const Iambus = require('iambus')
const safetyCatch = require('safety-catch')
const sodium = require('sodium-native')
const Updater = require('pear-updater')
const IPC = require('pear-ipc')
const { isMac, isWindows } = require('which-runtime')
const { command } = require('paparam')
const deriveEncryptionKey = require('pw-to-ek')
const plink = require('pear-link')
const rundef = require('pear-cmd/run')
const {
  PLATFORM_DIR, PLATFORM_LOCK, SOCKET_PATH, CHECKOUT,
  APPLINGS_PATH, SWAP, RUNTIME, ALIASES, SPINDOWN_TIMEOUT,
  WAKEUP, SALT, KNOWN_NODES_LIMIT
} = require('pear-constants')
const { ERR_INTERNAL_ERROR, ERR_INVALID_INPUT } = require('pear-errors')
const reports = require('./lib/reports')
const Applings = require('./lib/applings')
const Bundle = require('./lib/bundle')
const Replicator = require('./lib/replicator')
const Model = require('./lib/model')
const registerUrlHandler = require('../../url-handler')
const { version } = require('../../package.json')
const State = require('./state')
const ops = {
  GC: require('./ops/gc'),
  Release: require('./ops/release'),
  Stage: require('./ops/stage'),
  Seed: require('./ops/seed'),
  Dump: require('./ops/dump'),
  Info: require('./ops/info'),
  Shift: require('./ops/shift'),
  Drop: require('./ops/drop'),
  Touch: require('./ops/touch'),
  Data: require('./ops/data'),
  Build: require('./ops/build'),
  Run: require('./ops/run')
}

// ensure that we are registered as a link handler
registerUrlHandler(WAKEUP)

const SWARM_DELAY = 5000
const CHECKMARK = isWindows ? '^' : '✔'

class Sidecar extends ReadyResource {
  static Updater = Updater

  spindownt = null
  spindownms = SPINDOWN_TIMEOUT
  decomissioned = false
  updateAvailable = null
  swarm = null
  keyPair = null
  discovery = null

  teardown () { global.Bare.exit() }

  constructor ({ updater, drive, corestore, nodes, gunk }) {
    super()

    this.model = new Model(corestore.session())

    this.bus = new Iambus()
    this.version = CHECKOUT

    this.updater = updater
    if (this.updater) {
      this.updater.on('updating', (checkout) => {
        const { key, length } = checkout
        LOG.info('sidecar', key === this.version.key
          ? `- Updating to length ${length}...`
          : `- Switching to key ${key} with length ${length}...`
        )
        this.updatingNotify(checkout)
      })
      this.updater.on('update', (checkout) => this.updateNotify(checkout))
    }

    this.#spindownCountdown()

    this.drive = drive
    this.corestore = corestore
    this.nodes = nodes
    this.gunk = gunk

    this.ipc = new IPC.Server({
      handlers: this,
      lock: PLATFORM_LOCK,
      socketPath: SOCKET_PATH
    })

    this.ipc.on('client', (client) => {
      client.once('close', () => {
        if (client.clock <= 0) {
          if (client.userData instanceof this.App === false) {
            LOG.info('sidecar', 'Unresponsive non-app process detected with closed client id ' + client.id)
            return
          }
          if (client.userData.pid === null) {
            LOG.info('sidecar', 'Unresponsive app process detected with closed client id ' + client.id + ' (no pid provided)')
            return
          }
          LOG.info('sidecar', `Killing unresponsive process with pid ${client.userData.pid}`)
          os.kill(client.userData.pid, 'SIGKILL') // force close unresponsive process
          if (client.userData.state.parent) {
            const parent = this.apps.find((app) => app.state?.config.id === client.userData.state.parent)
            if (parent) {
              const link = client.userData.state.link
              parent.message({ type: 'pear/subprocess-killed', reason: 'unresponsive', link })
            }
          }
        }
        this.#spindownCountdown()
      })
    })

    this.replicator = updater ? new Replicator(updater.drive, { appling: true }) : null

    this.linker = new ScriptLinker(this.drive, {
      builtins: gunk.builtins,
      map: gunk.platform.map,
      mapImport: gunk.platform.mapImport,
      symbol: gunk.platform.symbol,
      protocol: gunk.platform.protocol,
      runtimes: gunk.platform.runtimes,
      bareBuiltins: gunk.bareBuiltins
    })

    this.bundle = new Bundle({ drive })

    this.applings = new Applings(APPLINGS_PATH)

    this.running = new Map()

    this._inspector = new Inspector({ inspector: bareInspector, bootstrap: this.nodes })

    const sidecar = this
    this.App = class App {
      sidecar = sidecar
      handlers = null
      linker = null
      bundle = null
      reported = null
      state = null
      session = null
      app = null
      unload = null
      unloader = null
      reporter = null
      cutover = null
      _pid = null
      #mapReport (report) {
        if (report.type === 'update') return reports.update(report)
        if (report.type === 'upgrade') return reports.upgrade()
        if (report.type === 'restarting') return reports.restarting()
        if (report.err?.code === 'ERR_PERMISSION_REQUIRED') return reports.permission(report)
        if (report.err?.code === 'ERR_CONNECTION') return reports.connection(report)
        if (report.err) console.trace('REPORT', report.err) // send generic errors to the text error log as well
        const args = [report.err?.message, report.err?.stack, report.info || report.err]
        if (report.err?.code === 'ERR_OPEN') return reports.dev(...args)
        if (report.err?.code === 'ERR_CRASH') return reports.crash(...args)
        return reports.generic(...args)
      }

      _updatingTrigger () {
        if (this.sidecar.updater?.updating) {
          this.message({ type: 'pear/updates', app: false, version: this.sidecar.updater.checkout, info: null, updating: true, updated: false })
        }
      }

      async _loadUnsafeAddon (drive, input, output) {
        try {
          const buf = await drive.get(output)
          if (!buf) return null

          const hash = Buffer.allocUnsafe(32)
          sodium.crypto_generichash(hash, buf)

          const m = output.match(/\/([^/@]+)(@[^/]+)?(\.node|\.bare)$/)
          if (!m) return null

          const prebuilds = path.join(SWAP, 'prebuilds', require.addon.host)
          const name = m[1] + '@' + hash.toString('hex') + m[3]

          output = path.join(prebuilds, name)

          try {
            await fs.promises.stat(output)
            return { input, output }
          } catch { }

          const tmp = output + '.tmp.' + Date.now() + m[3]

          await fs.promises.mkdir(prebuilds, { recursive: true })
          await fs.promises.writeFile(tmp, buf)
          await fs.promises.rename(tmp, output)

          return { input, output }
        } catch {
          return null
        }
      }

      register (client, startId, pid = -1) {
        this.clients.add(client)
        const userData = Object.create(this)
        userData.id = `${client.id}@${startId}`
        userData._pid = pid
        const opts = { map: pickData }
        userData.reporter = this.reporter.relay(this.sidecar.bus.sub({ topic: 'reports', id: userData.id }, opts))
        userData.warming = this.warming.relay(this.sidecar.bus.sub({ topic: 'warming', id: userData.id }, opts))
        userData.updates = this.updates.relay(userData.messages({ type: 'pear/updates' }, opts))
        return userData
      }

      get pid () {
        return this._pid === -1 ? null : (this._pid ?? this.state?.pid)
      }

      report (report) {
        this.reported = report
        return this.sidecar.bus.pub({ topic: 'reports', id: this.id, data: this.#mapReport(report) })
      }

      warmup (data) { return this.sidecar.bus.pub({ topic: 'warming', id: this.id, data }) }

      message (msg) {
        return this.sidecar.bus.pub({ topic: 'messages', id: this.id, data: msg })
      }

      messages (ptn, opts = {}) {
        if (ptn.type === 'pear/updates') {
          this._updatingTrigger() // TODO, remove when impl Pear.updating
        }
        opts.map = pickData
        const subscriber = this.sidecar.bus.sub({ topic: 'messages', id: this.id, ...(ptn ? { data: ptn } : {}) }, opts)
        return subscriber
      }

      teardown () {
        if (this.unload) {
          this.unload()
          return true
        }
        return false
      }

      unloading () {
        if (this.unloader) return this.unloader
        this.unloader = new Promise((resolve) => { this.unload = resolve })
        return this.unloader
      }

      constructor ({ id = '', startId = '', state = null, bundle = null, session }) {
        this.app = this
        this.session = session
        this.bundle = bundle
        this.id = id
        this.state = state
        this.startId = startId
        this.clients = new Set()
        const opts = { relays: true, replay: true, map: pickData }
        const reporter = this.sidecar.bus.sub({ topic: 'reports', id: this.id }, opts)
        const warming = this.sidecar.bus.sub({ topic: 'warming', id: this.id }, opts)
        const updates = this.messages({ type: 'pear/updates' }, opts)
        this.cutover = () => { // closure scoped to keep cutover refs to top ancestor subs
          reporter.replay = false
          warming.replay = false
          updates.replay = false
        }
        this.reporter = reporter
        this.warming = warming
        this.updates = updates
      }

      get closed () { return this.session.closed }
    }

    this.lazySwarmTimeout = setTimeout(() => {
      // We defer the ready incase the sidecar is immediately killed afterwards
      if (this.closed) return
      this.ready().catch((err) => LOG.error('internal', 'Failed to Open Sidecar', err))
    }, SWARM_DELAY)
    global.sidecar = this
  }

  async _open () {
    await this.#ensureSwarm()
    LOG.info('sidecar', '- Sidecar Booted')
    const gcCycle = async () => {
      await this.model.scavengeAssets()
      await this.model.gc()
    }
    gcCycle().catch(err => LOG.error('sidecar', 'GC error', err))
    const gcCycleMs = 10 * 60 * 1000 // 10 minutes
    this.gcInterval = setInterval(() => { gcCycle().catch(err => LOG.error('sidecar', 'GC error', err)) }, gcCycleMs)
  }

  get clients () { return this.ipc.clients }

  get hasClients () { return this.ipc?.hasClients || false }

  get apps () {
    return Array.from(new Set(this.ipc.clients.map(({ userData }) => userData).filter((userData) => userData instanceof this.App)))
  }

  #spindownCountdown () {
    clearTimeout(this.spindownt)
    if (this.decomissioned) return
    if (this.hasClients) return
    this.spindownt = setTimeout(async () => {
      if (this.hasClients || this.updater?.updating) return
      this.close().catch((err) => { LOG.error('internal', 'Failed to Close Sidecar', err) })
    }, this.spindownms)
  }

  async updatingNotify (checkout = null) {
    for await (const app of this.apps) {
      if (!app) continue

      app.message({ type: 'pear/updates', app: false, version: checkout, diff: null, updating: true, updated: false })
    }
  }

  async updateNotify (version, info = {}) {
    this.updateAvailable = { version, info }

    if (info.link) LOG.info('sidecar', 'Application update available:')
    else if (version.force) LOG.info('sidecar', 'Platform Force update (' + version.force.reason + '). Updating to:')
    else LOG.info('sidecar', 'Platform update available. Restart to update to:')
    LOG.info('sidecar', ' v' + version.fork + '.' + version.length + '.' + version.key + (info.link ? ' (' + info.link + ')' : ''))

    if (!info.link) this.spindownms = 0
    this.#spindownCountdown()
    const messaged = new Set()

    for await (const app of this.apps) {
      if (!app) continue

      if (messaged.has(app)) continue
      messaged.add(app)

      if (info.link && info.link === app.bundle?.link) {
        app.message({ type: 'pear/updates', app: true, version, diff: info.diff, updating: false, updated: true, link: info.link })
        continue
      }
      if (info.link) continue
      app.message({ type: 'pear/updates', app: false, version, diff: null, updating: false, updated: true, link: null })
    }
  }

  clientReady (params, client) { return client.ready() }

  async identify (params, client) {
    if (params.startId) {
      const started = this.running.get(params.startId)
      if (started) {
        client.userData = started.client.userData.register(client, params.startId, params.pid)
        if (params.startWait) await started.running
      } else throw ERR_INVALID_INPUT('identify failure unrecognized startId - did the origin app close?')
    }
    if (!client.userData) throw ERR_INTERNAL_ERROR('identify failure no userData')
    const id = client.userData.id
    return { id }
  }

  seed (params, client) { return new ops.Seed(params, client, this) }

  release (params, client) { return new ops.Release(params, client, this) }

  stage (params, client) { return new ops.Stage(params, client, this) }

  dump (params, client) { return new ops.Dump(params, client, this) }

  info (params, client) { return new ops.Info(params, client, this) }

  data (params, client) { return new ops.Data(params, client, this) }

  build (params, client) { return new ops.Build(params, client, this) }

  shift (params, client) { return new ops.Shift(params, client, this) }

  drop (params, client) { return new ops.Drop(params, client, this) }

  run (params, client) { return new ops.Run(params, client, this) }

  gc (params, client) { return new ops.GC(params, client, this) }

  touch (params, client) { return new ops.Touch(params, client, this) }

  warmup (params, client) {
    if (client.userData instanceof this.App === false) return
    return client.userData.warmup(params)
  }

  warming (params, client) {
    if (client.userData instanceof this.App === false) return
    return client.userData.warming
  }

  async versions (params, client) {
    const runtimes = { bare: Bare.versions.bare, pear: version }
    return { platform: this.version, app: client.userData?.state?.version, runtimes }
  }

  cutover (params, client) {
    const app = client.userData
    if (app instanceof this.App === false) return
    return app.cutover()
  }

  reports (params, client) {
    const app = client.userData
    if (app === null && params.id) {
      return this.bus.sub({ topic: 'reports', id: params.id }, { map: pickData })
    }
    if (app instanceof this.App === false) {
      LOG.error('reporting', 'invalid reports requests', params)
      return null
    }
    return app.reporter
  }

  createReport (params, client) {
    if (client.userData instanceof this.App === false) {
      console.trace('REPORT', params)
      return
    }
    return client.userData.report(params)
  }

  reported (params, client) {
    if (client.userData instanceof this.App === false) return false
    return client.userData.reported
  }

  async config (params, client) {
    if (client.userData instanceof this.App === false) return
    const cfg = client.userData.state.constructor.configFrom(client.userData.state)
    return cfg
  }

  async checkpoint (params, client) {
    if (client.userData instanceof this.App === false) return
    await fs.promises.writeFile(path.join(client.userData.state.storage, 'checkpoint'), params)
  }

  async message (params, client) {
    if (client.userData instanceof this.App === false) return
    return client.userData.message(params)
  }

  messages (pattern, client) {
    if (client.userData instanceof this.App === false) return
    return client.userData.messages(pattern)
  }

  exists (params, client) {
    if (client.userData instanceof this.App === false) return
    return client.userData.bundle.exists(params.key)
  }

  get (params, client) {
    if (client.userData instanceof this.App === false) return
    return client.userData.bundle.get(params.key)
  }

  entry (params, client) {
    if (client.userData instanceof this.App === false) return
    return client.userData.bundle.entry(params.key)
  }

  compare (params, client) {
    if (client.userData instanceof this.App === false) return
    return client.userData.bundle.drive.compare(params.keyA, params.keyB)
  }

  async permit (params) {
    let encryptionKey
    if (params.password || params.encryptionKey) {
      encryptionKey = params.encryptionKey || await deriveEncryptionKey(params.password, SALT)
    }
    if (params.key !== null) {
      const link = `pear://${hypercoreid.encode(params.key)}`
      const bundle = await this.model.getBundle(link)
      if (!bundle) {
        await this.model.addBundle(link, State.storageFromLink(link))
      }
      return await this.model.updateEncryptionKey(link, encryptionKey)
    }
  }

  async trusted (link) {
    const aliases = Object.keys(ALIASES).map((alias) => 'pear://' + alias)
    const aliasesKeys = Object.values(ALIASES).map((key) => `pear://${hypercoreid.encode(key)}`)
    return aliases.includes(link) || aliasesKeys.includes(link) || await this.model.getBundle(link) !== null
  }

  async detached ({ link, key, storage, appdev }) {
    if (!key) return false // ignore bad requests
    if (!storage) {
      storage = path.join(PLATFORM_DIR, 'app-storage', 'by-dkey', crypto.discoveryKey(key).toString('hex'))
    }

    const wokeup = await this.wakeup({ args: [link, storage, appdev, false, null] })
    if (wokeup) return { wokeup, appling: null }

    const appling = (await this.applings.get(key.toString('hex'))) || null
    return { wokeup, appling }
  }

  shutdown (params, client) { return this.#shutdown(client) }

  inspect (params, client) {
    if (!this._inspector.dht) {
      return this._inspector.enable()
    } else {
      return this._inspector.inspectorKey
    }
  }

  #endRPCStreams (client) {
    // TODO: instead of client._rpc collect src and dst streams in sidecar, do push(null) on src stream, listen for close on dst stream
    const streams = client._rpc._handlers.flatMap((m) => m?._streams).filter((m) => m?.destroyed === false)
    return Promise.all(streams.map((stream) => new Promise((resolve) => {
      stream.once('close', resolve)
      stream.end()
    })))
  }

  closeClients (params = {}, originClient) {
    if (this.hasClients === false) return []
    const metadata = []
    const seen = new Set()
    for (const client of this.clients) {
      if (!params.inclusive && client === originClient) {
        continue
      }
      if (!client.userData || !client.userData.state) { // user & stateless ipc clients
        metadata.push({}) // count the client close
        this.#endRPCStreams(client).then(() => client.close())
        continue
      }
      if (seen.has(client.userData.state.id)) continue
      seen.add(client.userData.state.id)
      const isApp = client.userData instanceof this.App
      const { id, cmdArgs, cwd, dir, appling, env, options } = client.userData.state
      if (!client.userData.state.parent) {
        metadata.push({ id, cmdArgs, cwd, dir, appling, env, options, isApp })
      }
      const tearingDown = isApp && client.userData.teardown()
      // TODO: close timeout for tearingDown clients
      if (tearingDown === false) this.#endRPCStreams(client).then(() => client.close())
    }
    return metadata
  }

  async restart ({ platform = false } = {}, client) {
    LOG.info('sidecar', `Restarting ${platform ? 'platform' : 'client'}`)
    this.spindownms = SPINDOWN_TIMEOUT
    if (platform === false) {
      if (client.userData instanceof this.App === false) {
        LOG.info('sidecar', 'Invalid restart request from non-app client')
        return
      }
      const { dir, cwd, cmdArgs, env } = client.userData.state
      const appling = client.userData.state.appling
      const opts = { cwd, env }
      if (!client.closed) {
        const tearingDown = client.userData.teardown()
        if (tearingDown) {
          // TODO: close timeout
          await new Promise((resolve) => { client.once('close', resolve) })
        } else {
          await this.#endRPCStreams(client)
          await client.close()
        }
      }
      if (appling) {
        const applingPath = typeof appling === 'string' ? appling : appling?.path
        if (isMac) daemon.spawn('open', [applingPath.split('.app')[0] + '.app'], opts)
        else daemon.spawn(applingPath, opts)
      } else {
        const cmd = command('run', ...rundef)
        cmd.parse(cmdArgs.slice(1))

        const linkIndex = cmd?.indices?.args?.link
        const link = cmd?.args?.link
        if (linkIndex !== undefined) {
          if (!link.startsWith('pear://') && !link.startsWith('file://')) cmdArgs[linkIndex + 1] = dir
        } else {
          cmdArgs.push(dir)
        }

        daemon.spawn(RUNTIME, cmdArgs, opts)
      }

      return
    }

    const sidecarClosed = new Promise((resolve) => this.corestore.once('close', resolve))
    let restarts = await this.#shutdown(client)
    // ample time for any OS cleanup operations:
    await new Promise((resolve) => setTimeout(resolve, 1500))
    // shutdown successful, reset death clock
    this.deathClock()

    restarts = restarts.filter(({ isApp }) => isApp)
    if (restarts.length === 0) return
    LOG.info('sidecar', 'Restarting', restarts.length, 'apps')

    await sidecarClosed

    for (const { cwd, dir, appling, cmdArgs, env } of restarts) {
      const opts = { cwd, env }
      if (appling) {
        const applingPath = typeof appling === 'string' ? appling : appling?.path
        if (isMac) daemon.spawn('open', [applingPath.split('.app')[0] + '.app'], opts)
        else daemon.spawn(applingPath, opts)
      } else {
        const TARGET_RUNTIME = this.updater === null
          ? RUNTIME
          : this.updater.swap + RUNTIME.slice(SWAP.length)

        const cmd = command('run', ...rundef)
        cmd.parse(cmdArgs.slice(1))

        const linkIndex = cmd?.indices?.args?.link
        const link = cmd?.args?.link
        if (linkIndex !== undefined) {
          if (!link.startsWith('pear://') && !link.startsWith('file://')) cmdArgs[linkIndex + 1] = dir
        } else {
          cmdArgs.push(dir)
        }

        daemon.spawn(TARGET_RUNTIME, cmdArgs, opts)
      }
    }
  }

  wakeup (params = {}) {
    const [link, storage, appdev = null, selfwake = true, startId] = params.args
    const parsed = plink.parse(link)
    return this.model.getAppStorage(parsed).then((appStorage) => {
      return new Promise((resolve) => {
        if (this.hasClients === false) {
          resolve(false)
          return
        }

        if (parsed.drive.key === null && appdev === null) {
          resolve(false)
          return
        }
        const matches = [...this.apps].filter((app) => {
          if (!app || !app.state) return false
          if (startId === app.startId) return false
          return app.state.storage === (storage || appStorage) && (appdev
            ? app.state.dir === appdev
            : app.state.key && (hypercoreid.encode(app.state.key) === hypercoreid.encode(parsed.drive.key))
          )
        })
        for (const app of matches) {
          const pathname = parsed.pathname
          const fragment = parsed.hash ? parsed.hash.slice(1) : null
          const query = parsed.search ? parsed.search.slice(1) : null
          const linkData = pathname?.startsWith('/') ? pathname.slice(1) : pathname
          app.message({ type: 'pear/wakeup', link, applink: app.state.applink, entrypoint: pathname, fragment, query, linkData })
        }
        const min = selfwake ? 1 : 0
        resolve(matches.length > min)
      })
    })
  }

  unloading (params, client) {
    if (client.userData instanceof this.App === false) return
    return client.userData.unloading()
  }

  async #ensureSwarm () {
    try {
      await this.corestore.ready()
      await this.bundle.ready()
    } catch (err) {
      err.code = 'ERR_OPEN'
      throw err
    }
    this.keyPair = await this.corestore.createKeyPair('holepunch')
    if (this.nodes) LOG.info('sidecar', 'DHT bootstrap set', this.nodes)
    const knownNodes = await this.model.getDhtNodes()
    const nodes = this.nodes ? undefined : knownNodes
    if (nodes) {
      LOG.info('sidecar', '- DHT known-nodes read from database ' + nodes.length + ' nodes')
      LOG.trace('sidecar', nodes.map(node => `  - ${node.host}:${node.port}`).join('\n'))
    }
    this.swarm = new Hyperswarm({ keyPair: this.keyPair, bootstrap: this.nodes, nodes })
    this.swarm.once('close', () => { this.swarm = null })
    this.swarm.on('connection', (connection) => { this.corestore.replicate(connection) })
    if (this.replicator !== null) this.replicator.join(this.swarm, { server: false, client: true }).catch(safetyCatch)
  }

  getCorestore (name, channel, opts) {
    if (!name || !channel) return this.corestore.session({ writable: false, ...opts })
    return this.corestore.namespace(`${name}~${channel}`, { writable: false, ...opts })
  }

  async #shutdown (client) {
    LOG.info('sidecar', '- Sidecar Shutting Down...')
    const tearingDown = client.userData instanceof this.App && client.userData.teardown()
    if (tearingDown === false) await this.#endRPCStreams(client).then(() => client.close())
    this.spindownms = 0
    const restarts = this.closeClients()
    this.#spindownCountdown()
    await this.closing
    return restarts
  }

  async #close () {
    await this.applings.close()
    clearInterval(this.gcInterval)
    clearTimeout(this.lazySwarmTimeout)
    if (this.replicator) await this.replicator.leave(this.swarm)
    if (this.swarm) {
      if (!this.nodes) {
        const knownNodes = this.swarm.dht.toArray({ limit: KNOWN_NODES_LIMIT })
        if (knownNodes.length) {
          await this.model.setDhtNodes(knownNodes)
          LOG.info('sidecar', '- DHT known-nodes wrote to database ' + knownNodes.length + ' nodes')
          LOG.trace('sidecar', knownNodes.map(node => `  - ${node.host}:${node.port}`).join('\n'))
        }
      }
      await this.swarm.destroy()
    }
    await this.model.close()
    if (this.corestore) await this.corestore.close()
    LOG.info('sidecar', CHECKMARK + ' Sidecar Closed')
  }

  async _close () {
    if (this.decomissioned) return
    this.decomissioned = true
    await this._inspector.disable()
    for (const client of this.clients) {
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
      if (await this.updater.applyUpdate() !== null) {
        LOG.info('sidecar', CHECKMARK + ' Applied update')
      }
    }
  }

  deathClock (ms = 20000) {
    clearTimeout(this.bailout)
    this.bailout = setTimeout(async () => {
      if (this.updater) {
        try {
          if (await this.updater.applyUpdate() !== null) {
            LOG.info('sidecar', LOG.CHECKMARK + ' Applied update')
          }
        } catch (err) {
          LOG.error('sidecar', err)
        }
      }
      LOG.error('internal', 'DEATH CLOCK TRIGGERED, FORCE KILLING. EXIT CODE 124')
      Bare.exit(124) // timeout
    }, ms).unref()
  }
}

function pickData (msg) {
  return msg.data ?? msg
}

module.exports = Sidecar
