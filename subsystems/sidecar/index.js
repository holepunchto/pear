'use strict'
const fs = require('bare-fs')
const path = require('bare-path')
const { spawn } = require('bare-subprocess')
const fsx = require('fs-native-extensions')
const streamx = require('streamx')
const ReadyResource = require('ready-resource')
const ScriptLinker = require('script-linker')
const LocalDrive = require('localdrive')
const Hyperswarm = require('hyperswarm')
const hypercoreid = require('hypercore-id-encoding')
const Hyperdrive = require('hyperdrive')
const crypto = require('hypercore-crypto')
const Iambus = require('iambus')
const safetyCatch = require('safety-catch')
const sodium = require('sodium-native')
const Updater = require('pear-updater')
const IPC = require('pear-ipc')
const { isMac } = require('which-runtime')
const { command } = require('paparam')
const { pathToFileURL } = require('url-file-url')
const deriveEncryptionKey = require('pw-to-ek')
const rundef = require('pear-api/cmd/run')
const reports = require('./lib/reports')
const Applings = require('./lib/applings')
const Bundle = require('./lib/bundle')
const Replicator = require('./lib/replicator')
const Session = require('./lib/session')
const Model = require('./lib/model')
const registerUrlHandler = require('../../url-handler')
const parseLink = require('pear-api/parse-link')
const { version } = require('../../package.json')
const {
  PLATFORM_DIR, PLATFORM_LOCK, SOCKET_PATH, CHECKOUT,
  APPLINGS_PATH, SWAP, RUNTIME, DESKTOP_RUNTIME, ALIASES, SPINDOWN_TIMEOUT,
  WAKEUP, SALT, KNOWN_NODES_LIMIT
} = require('pear-api/constants')
const { ERR_INTERNAL_ERROR, ERR_PERMISSION_REQUIRED } = require('pear-api/errors')
const State = require('./state')
const ops = {
  GC: require('./ops/gc'),
  Release: require('./ops/release'),
  Stage: require('./ops/stage'),
  Seed: require('./ops/seed'),
  Dump: require('./ops/dump'),
  Info: require('./ops/info'),
  Shift: require('./ops/shift'),
  Touch: require('./ops/touch')
}

// ensure that we are registered as a link handler
registerUrlHandler(WAKEUP)

const SWARM_DELAY = 5000

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

  constructor ({ updater, drive, corestore, gunk, flags }) {
    super()

    this.model = new Model()

    this.dhtBootstrap = typeof flags.dhtBootstrap === 'string'
      ? flags.dhtBootstrap.split(',').map(e => ({ host: e.split(':')[0], port: Number(e.split(':')[1]) }))
      : flags.dhtBootstrap

    this.bus = new Iambus()
    this.version = CHECKOUT

    this.updater = updater
    if (this.updater) this.updater.on('update', (checkout) => this.updateNotify(checkout))

    this.#spindownCountdown()

    this.drive = drive
    this.corestore = corestore
    this.gunk = gunk

    this.ipc = new IPC.Server({
      handlers: this,
      lock: PLATFORM_LOCK,
      socketPath: SOCKET_PATH
    })

    this.ipc.on('client', (client) => {
      client.once('close', () => {
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

    const sidecar = this
    this.App = class App {
      sidecar = sidecar
      handlers = null
      linker = null
      bundle = null
      reporter = null
      reported = null
      state = null
      session = null
      app = null
      unload = null
      unloader = null
      minvering = false
      #mapReport (report) {
        if (report.type === 'update') return reports.update(report)
        if (report.type === 'upgrade') return reports.upgrade()
        if (report.type === 'restarting') return reports.restarting()
        if (report.err?.code === 'ERR_PERMISSION_REQUIRED') return reports.permissionRequired(report)
        if (report.err?.code === 'ERR_INVALID_LENGTH') return reports.minver(report)
        if (report.err?.code === 'ERR_CONNECTION') return reports.connection()
        if (report.err) console.trace('REPORT', report.err) // send generic errors to the text error log as well
        const args = [report.err?.message, report.err?.stack, report.info || report.err]
        if (report.err?.code === 'ERR_OPEN') return reports.dev(...args)
        if (report.err?.code === 'ERR_CRASH') return reports.crash(...args)
        return reports.generic(...args)
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

      async minver () {
        const { state } = this
        if (state.options.minver && this.sidecar.updater !== null) {
          this.minvering = true
          const current = {
            length: this.sidecar.drive.version,
            fork: this.sidecar.drive.fork,
            key: this.sidecar.drive.core.id
          }
          const minver = {
            key: hypercoreid.normalize(state.options.minver.key),
            length: state.options.minver.length,
            fork: state.options.minver.fork
          }
          if (minver.key !== current.key) {
            LOG.error('internal', 'Specified minver key', minver.key, ' does not match current version key', current.key, '. Ignoring.\nminver:', minver, '\ncurrent:', this.version)
          } else if (typeof minver.length !== 'number') {
            LOG.error('internal', `Invalid minver (length is required). Ignoring. minver: ${minver.fork}.${minver.length}.${minver.key}`)
          } else if (minver.length > current.length) {
            const checkout = {
              length: minver.length,
              fork: minver.fork || 0,
              key: minver.key,
              force: { reason: 'minver' },
              current
            }

            this.report({ type: 'update', version: checkout })

            try {
              await this.sidecar.updater.wait(checkout)
              this.sidecar.updateNotify(checkout)
              return true
            } catch (err) {
              this.report({ err })
            }
          }
          this.minvering = false
        }
      }

      report (report) {
        this.reported = report
        return this.sidecar.bus.pub({ topic: 'reports', id: this.id, data: this.#mapReport(report) })
      }

      warmup (data) { return this.sidecar.bus.pub({ topic: 'warming', id: this.id, data }) }

      message (msg) { return this.sidecar.bus.pub({ topic: 'messages', id: this.id, data: msg }) }

      messages (ptn) {
        const subscriber = this.sidecar.bus.sub({ topic: 'messages', id: this.id, ...(ptn ? { data: ptn } : {}) })
        const stream = new streamx.PassThrough({ objectMode: true })
        streamx.pipeline(subscriber, pickData(), stream)
        return stream
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
        this.warming = this.sidecar.bus.sub({ topic: 'warming', id: this.id })
        this.reporter = this.sidecar.bus.sub({ topic: 'reports', id: this.id })
        this.startId = startId
      }

      get closed () { return this.session.closed }
    }

    this.lazySwarmTimeout = setTimeout(() => {
      // We defer the ready incase the sidecar is immediately killed afterwards
      if (this.closed) return
      this.ready().catch((err) => LOG.error('internal', 'Failed to Open Sidecar', err))
    }, SWARM_DELAY)
  }

  async _open () {
    await this.#ensureSwarm()
    LOG.info('sidecar', '- Sidecar Booted')
  }

  get clients () { return this.ipc.clients }

  get hasClients () { return this.ipc?.hasClients || false }

  get apps () {
    return Array.from(new Set(this.ipc.clients.map(({ userData }) => userData).filter(Boolean)))
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

  async updateNotify (version, info = {}) {
    this.spindownms = 0
    this.updateAvailable = { version, info }

    if (info.link) LOG.info('sidecar', 'Application update available:')
    else if (version.force) LOG.info('sidecar', 'Platform Force update (' + version.force.reason + '). Updating to:')
    else LOG.info('sidecar', 'Platform update Available. Restart to update to:')
    LOG.info('sidecar', ' v' + version.fork + '.' + version.length + '.' + version.key + (info.link ? ' (' + info.link + ')' : ''))

    this.#spindownCountdown()
    const messaged = new Set()

    for await (const app of this.apps) {
      if (!app || (app.minvering === true && !version.force)) continue

      if (messaged.has(app)) continue
      messaged.add(app)

      if (info.link && info.link === app.bundle?.link) {
        app.message({ type: 'pear/updates', app: true, version, diff: info.diff })
        continue
      }
      if (info.link) continue
      app.message({ type: 'pear/updates', app: false, version, diff: null })
    }
  }

  clientReady (params, client) { return client.ready() }

  async identify (params, client) {
    if (params.startId) {
      const starting = this.running.get(params.startId)
      if (starting) client.userData = starting.client.userData
      else throw ERR_INTERNAL_ERROR('identify failure unrecognized startId (check crash logs)')
    }
    if (!client.userData) throw ERR_INTERNAL_ERROR('identify failure no userData (check crash logs)')
    const id = client.userData.id
    return { id }
  }

  seed (params, client) { return new ops.Seed(params, client, this) }

  release (params, client) { return new ops.Release(params, client, this) }

  stage (params, client) { return new ops.Stage(params, client, this) }

  dump (params, client) { return new ops.Dump(params, client, this) }

  info (params, client) { return new ops.Info(params, client, this) }

  shift (params, client) { return new ops.Shift(params, client, this) }

  gc (params, client) { return new ops.GC(params, client) }

  touch (params, client) { return new ops.Touch(params, client, this) }

  warmup (params, client) {
    if (!client.userData) return
    return client.userData.warmup(params)
  }

  warming (params, client) {
    if (!client.userData) return
    const stream = new streamx.PassThrough({ objectMode: true })
    streamx.pipeline(client.userData.warming, pickData(), stream)
    return stream
  }

  async versions (params, client) {
    const runtimes = { bare: Bare.versions.bare, pear: version }
    return { platform: this.version, app: client.userData?.state?.version, runtimes }
  }

  reports (params, client) {
    if (!client.userData) return
    const stream = new streamx.PassThrough({ objectMode: true })
    streamx.pipeline(client.userData.reporter, pickData(), stream)
    return stream
  }

  createReport (err, client) {
    if (!client.userData) {
      console.trace('REPORT', err)
      return
    }
    return client.userData.report({ err: { message: err.message, stack: err.stack, code: err.code, clientCreated: true } })
  }

  reported (params, client) {
    if (!client.userData) return false
    return client.userData.reported
  }

  minver (params, client) {
    if (!client.userData) return null
    return client.userData.minver()
  }

  async config (params, client) {
    if (!client.userData) return
    const cfg = client.userData.state.constructor.configFrom(client.userData.state)
    return cfg
  }

  async checkpoint (params, client) {
    if (!client.userData) return
    await fs.promises.writeFile(path.join(client.userData.state.storage, 'checkpoint'), params)
  }

  async message (params, client) {
    if (!client.userData) return
    return client.userData.message(params)
  }

  messages (pattern, client) {
    if (!client.userData) return
    return client.userData.messages(pattern)
  }
  
  exists (params, client) {
    if (!client.userData) return
    return client.userData.bundle.exists(params.key)
  }

  get (params, client) {
    if (!client.userData) return
    if (params.bundle === true) return client.userData.bundle.bundle(params.key)
    return client.userData.bundle.get(params.key)
  }

  entry (params, client) {
    if (!client.userData) return
    return client.userData.bundle.entry(params.key)
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
        await this.model.addBundle(link, this._generateAppStorage(parseLink(link)))
      }
      return await this.model.updateEncryptionKey(link, encryptionKey)
    }
  }

  async trusted (link) {
    const aliases = Object.keys(ALIASES).map(e => `pear://${e}`)
    const aliasesKeys = Object.values(ALIASES).map(e => `pear://${hypercoreid.encode(e)}`)
    return aliases.includes(link) || aliasesKeys.includes(link) || await this.model.getBundle(link) !== null
  }

  async detached ({ link, key, storage, appdev }) {
    if (!key) return false // ignore bad requests
    if (!storage) {
      storage = path.join(PLATFORM_DIR, 'app-storage', 'by-dkey', crypto.discoveryKey(key).toString('hex'))
    }

    const wokeup = await this.wakeup({ args: [link, storage, appdev, false] })

    if (wokeup) return { wokeup, appling: null }
    const appling = (await this.applings.get(key.toString('hex'))) || null

    return { wokeup, appling }
  }

  shutdown (params, client) { return this.#shutdown(client) }

  appClosed (params, client) { return client.userData?.closed ?? false }

  #teardownPipelines (client) {
    // TODO: instead of client._rpc collect src and dst streams in sidecar, do push(null) on src stream, listen for close on dst stream
    const streams = client._rpc._handlers.flatMap((m) => m?._streams).filter((m) => m?.destroyed === false)
    return Promise.all(streams.map((stream) => new Promise((resolve) => {
      stream.once('close', resolve)
      stream.end()
    })))
  }

  closeClients () {
    if (this.hasClients === false) return []
    const metadata = []
    const seen = new Set()
    for (const client of this.clients) {
      const app = client.userData
      if (!app || !app.state) continue // ignore e.g. `pear sidecar` cli i/o client
      if (seen.has(app.state.id)) continue
      seen.add(app.state.id)
      const { pid, cmdArgs, cwd, dir, runtime, appling, env, run, options } = app.state
      metadata.push({ pid, cmdArgs, cwd, dir, runtime, appling, env, run, options })
      const tearingDown = app.teardown()
      if (tearingDown === false) this.#teardownPipelines(client).then(() => client.close())
    }
    return metadata
  }

  async restart ({ platform = false } = {}, client) {
    LOG.info('sidecar', `Restarting ${platform ? 'platform' : 'client'}`)
    if (platform === false) {
      const { dir, cwd, cmdArgs, env } = client.userData.state
      const appling = client.userData.state.appling
      const opts = { cwd, env, detached: false, stdio: 'pipe' }
      if (!client.closed) {
        await new Promise((resolve) => {
          if (client.closed) {
            resolve()
            return
          }
          client.once('close', resolve)
          const app = client.userData
          const tearingDown = !!app && app.teardown()
          if (tearingDown === false) this.#teardownPipelines(client).then(() => client.close())
        })
      }
      if (appling) {
        const applingPath = typeof appling === 'string' ? appling : appling?.path
        if (isMac) spawn('open', [applingPath.split('.app')[0] + '.app'], opts).unref()
        else spawn(applingPath, opts).unref()
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

        spawn(RUNTIME, cmdArgs, opts).unref()
      }

      return
    }

    const sidecarClosed = new Promise((resolve) => this.corestore.once('close', resolve))
    let restarts = await this.#shutdown(client)
    // ample time for any OS cleanup operations:
    await new Promise((resolve) => setTimeout(resolve, 1500))
    // shutdown successful, reset death clock
    this.deathClock()

    restarts = restarts.filter(({ run }) => run)
    if (restarts.length === 0) return
    LOG.info('sidecar', 'Restarting', restarts.length, 'apps')

    await sidecarClosed

    for (const { cwd, dir, appling, cmdArgs, env, options } of restarts) {
      const opts = { cwd, env, detached: true, stdio: 'ignore' }
      if (appling) {
        const applingPath = typeof appling === 'string' ? appling : appling?.path
        if (isMac) spawn('open', [applingPath.split('.app')[0] + '.app'], opts).unref()
        else spawn(applingPath, opts).unref()
      } else {
        const TARGET_RUNTIME = this.updater === null
          ? (options?.ui === null ? RUNTIME : DESKTOP_RUNTIME)
          : this.updater.swap + (options?.ui === null ? RUNTIME : DESKTOP_RUNTIME).slice(SWAP.length)

        const cmd = command('run', ...rundef)
        cmd.parse(cmdArgs.slice(1))

        const linkIndex = cmd?.indices?.args?.link
        const link = cmd?.args?.link
        if (linkIndex !== undefined) {
          if (!link.startsWith('pear://') && !link.startsWith('file://')) cmdArgs[linkIndex + 1] = dir
        } else {
          cmdArgs.push(dir)
        }

        spawn(TARGET_RUNTIME, cmdArgs, opts).unref()
      }
    }
  }

  wakeup (params = {}) {
    const [link, storage, appdev = null, selfwake = true] = params.args
    return new Promise((resolve) => {
      if (this.hasClients === false) {
        resolve(false)
        return
      }
      const parsed = parseLink(link)
      if (parsed.drive.key === null && appdev === null) {
        resolve(false)
        return
      }
      const matches = [...this.apps].filter((app) => {
        if (!app || !app.state) return false
        return app.state.storage === storage && (appdev
          ? app.state.dir === appdev
          : !!app.state.key && (hypercoreid.encode(app.state.key) === hypercoreid.encode(parsed.drive.key))
        )
      })

      for (const app of matches) {
        const pathname = parsed.pathname
        const segment = pathname?.startsWith('/') ? pathname.slice(1) : pathname
        const fragment = parsed.hash ? parsed.hash.slice(1) : (State.isKeetInvite(segment) ? segment : null)
        app.message({ type: 'pear/wakeup', link, applink: app.state.applink, entrypoint: pathname, fragment, linkData: segment })
      }

      const min = selfwake ? 1 : 0
      resolve(matches.length > min)
    })
  }

  unloading (params, client) { return client.userData.unloading() }

  async start (params, client) {
    const { flags, env, cwd, link, dir, args, cmdArgs } = params
    const LOG_RUN_LINK = ['run', link]
    if (LOG.INF) LOG.info(LOG_RUN_LINK, 'start', link.slice(0, 14) + '..')
    let { startId } = params
    const starting = this.running.get(startId)
    if (starting) {
      LOG.info(LOG_RUN_LINK, startId, 'running, referencing existing client userData')
      client.userData = starting.client.userData
      return await starting.running
    }
    if (startId && !starting) throw ERR_INTERNAL_ERROR('start failure unrecognized startId')
    startId = client.userData?.startId || crypto.randomBytes(16).toString('hex')
    LOG.info('session', 'new session for', startId)
    const session = new Session(client)

    const running = this.#start(flags, client, session, env, cwd, link, dir, startId, args, cmdArgs)
    this.running.set(startId, { client, running })
    session.teardown(() => {
      const free = this.running.get(startId)
      LOG.info(LOG_RUN_LINK, client.userData.id, 'teardown')
      LOG.info('session', 'tearing down for', startId)
      if (free.running === running) {
        this.running.delete(startId)
        LOG.info(LOG_RUN_LINK, startId, 'removed from running set')
      }
    })

    try {
      const info = await running
      if (this.updateAvailable !== null) {
        const { version, info } = this.updateAvailable
        LOG.info(LOG_RUN_LINK, client.userData.id, 'application update available, notifying application', version)
        client.userData.message({ type: 'pear/updates', version, diff: info.diff })
      }
      return info
    } catch (err) {
      await session.close()
      LOG.info('session', 'session closed for', startId)
      throw err
    }
  }

  async #start (flags, client, session, env, cwd, link, dir, startId, args, cmdArgs) {
    const id = client.userData?.id || `${client.id}@${startId}`
    const app = client.userData = client.userData?.id ? client.userData : new this.App({ id, startId, session })
    const LOG_RUN_LINK = ['run', link]
    if (LOG.INF) LOG.info(LOG_RUN_LINK, id, link.slice(0, 14) + '..')
    LOG.info(LOG_RUN_LINK, 'ensuring sidecar ready')
    await this.ready()
    LOG.info(LOG_RUN_LINK, 'sidecar is ready')

    const parsedLink = parseLink(link)
    LOG.info(LOG_RUN_LINK, id, 'loading encryption keys')

    const key = parsedLink.drive?.key

    if (key !== null && !flags.trusted) {
      const trusted = await this.trusted(`pear://${hypercoreid.encode(key)}`)
      if (!trusted) {
        const state = new State({ id, env, link, dir, cwd, flags, args, cmdArgs, run: true })
        app.state = state // needs to setup app state for decal trust dialog restart
        const err = new ERR_PERMISSION_REQUIRED('Permission required to run key', { key })
        app.report({ err })
        LOG.info(LOG_RUN_LINK, id, 'untrusted - bailing')
        return { startId, bail: err }
      }
    }

    link = (link.startsWith('pear:') || link.startsWith('file:')) ? link : pathToFileURL(link).href

    const persistedBundle = await this.model.getBundle(link) || await this.model.addBundle(link, this._generateAppStorage(parsedLink))
    const encryptionKey = persistedBundle.encryptionKey
    const appStorage = persistedBundle.appStorage

    await fs.promises.mkdir(appStorage, { recursive: true })

    const dht = { nodes: this.swarm.dht.toArray({ limit: KNOWN_NODES_LIMIT }), bootstrap: this.dhtBootstrap }
    const state = new State({ dht, id, env, link, dir, cwd, flags, args, cmdArgs, run: true, storage: appStorage })
    const applingPath = state.appling?.path
    if (applingPath && state.key !== null) {
      const applingKey = state.key.toString('hex')
      LOG.info(LOG_RUN_LINK, id, 'appling detected, storing path')
      await this.applings.set(applingKey, applingPath)
    }

    app.state = state

    if (state.key === null) {
      LOG.info(LOG_RUN_LINK, id, 'running from disk')
      const drive = new LocalDrive(state.dir, { followExternalLinks: true, followLinks: state.followSymlinks })
      this.#updatePearInterface(drive)
      const appBundle = new Bundle({
        drive,
        updatesDiff: state.updatesDiff,
        updateNotify: state.updates && ((version, info) => this.updateNotify(version, info))
      })
      const linker = new ScriptLinker(appBundle, {
        builtins: this.gunk.builtins,
        map: this.gunk.app.map,
        mapImport: this.gunk.app.mapImport,
        symbol: this.gunk.app.symbol,
        protocol: this.gunk.app.protocol,
        runtimes: this.gunk.app.runtimes
      })
      LOG.info('session', 'adding appBundle to session for', startId)
      await session.add(appBundle)
      LOG.info('session', 'appBundle added to session for', startId)
      app.linker = linker
      app.bundle = appBundle

      LOG.info(LOG_RUN_LINK, id, 'initializing state')
      try {
        await state.initialize({ bundle: appBundle, app, staging: true })
        LOG.info(LOG_RUN_LINK, id, 'state initialized')
      } catch (err) {
        LOG.error([...LOG_RUN_LINK, 'internal'], 'Failed to initialize state for app id', id, err)
        if (err.code === 'ERR_CONNECTION') app.report({ err })
      }
      LOG.info(LOG_RUN_LINK, id, 'checking minver')
      const updating = await app.minver()
      if (updating) LOG.info(LOG_RUN_LINK, id, 'minver updating:', !!updating)
      else LOG.info(LOG_RUN_LINK, id)
      const bundle = await app.bundle.bundle(state.entrypoint)
      LOG.info(LOG_RUN_LINK, id, 'run initialization complete')
      return { id, startId, bundle }
    }

    LOG.info(LOG_RUN_LINK, id, 'checking drive for encryption')
    const corestore = this._getCorestore(state.manifest?.name, state.channel)
    let drive
    try {
      drive = new Hyperdrive(corestore, state.key, { encryptionKey })
      await drive.ready()
    } catch (err) {
      if (err.code !== 'DECODING_ERROR') {
        LOG.error([...LOG_RUN_LINK, 'internal'], 'Failure checking for encryption for', link, 'app id:', id, err)
        throw err
      }
      LOG.info(LOG_RUN_LINK, id, 'drive is encrypted and key is required - bailing')
      const permissionError = new ERR_PERMISSION_REQUIRED('Encryption key required', { key: state.key, encrypted: true })
      app.report({ err: permissionError })
      return { startId, bail: permissionError }
    }

    const appBundle = new Bundle({
      encryptionKey,
      corestore,
      appling: state.appling,
      channel: state.channel,
      checkout: state.checkout,
      key: state.key,
      name: state.manifest?.name,
      dir: state.key ? null : state.dir,
      updatesDiff: state.updatesDiff,
      drive,
      updateNotify: state.updates && ((version, info) => this.updateNotify(version, info)),
      async failure (err) {
        LOG.error([...LOG_RUN_LINK, 'internal'], 'Failure creating drive bundle for', link, 'app id:', id, err)
        app.report({ err })
      }
    })

    LOG.info('session', 'adding appBundle to session for', startId)
    await session.add(appBundle)
    LOG.info('session', 'appBundle added to session for', startId)

    if (this.swarm) appBundle.join(this.swarm)

    const linker = new ScriptLinker(appBundle, {
      builtins: this.gunk.builtins,
      map: this.gunk.app.map,
      mapImport: this.gunk.app.mapImport,
      symbol: this.gunk.app.symbol,
      protocol: this.gunk.app.protocol,
      runtimes: this.gunk.app.runtimes
    })

    app.linker = linker
    app.bundle = appBundle

    try {
      await appBundle.calibrate()
    } catch (err) {
      if (err.code === 'DECODING_ERROR') {
        LOG.info(LOG_RUN_LINK, id, 'drive is encrypted and key is required - bailing')
        const bail = new ERR_PERMISSION_REQUIRED('Encryption key required', { key: state.key, encrypted: true })
        app.report({ err: bail })
        return { startId, bail }
      } else {
        LOG.error(LOG_RUN_LINK, 'Failure creating drive bundle for', link, 'app id:', id, err)
        LOG.info('session', 'closing session for', startId)
        await session.close()
        LOG.info('session', 'session closed for', startId)
        throw err
      }
    }

    LOG.info(LOG_RUN_LINK, id, 'initializing state')
    try {
      await state.initialize({ bundle: appBundle, app })
      LOG.info(LOG_RUN_LINK, id, 'state initialized')
    } catch (err) {
      LOG.error([...LOG_RUN_LINK, 'internal'], 'Failed to initialize state for app id', id, err)
      if (err.code === 'ERR_CONNECTION') app.report({ err })
    }
    if (appBundle.platformVersion !== null) {
      app.report({ type: 'upgrade' })
      LOG.info(LOG_RUN_LINK, id, 'app bundling..')
      const bundle = await app.bundle.bundle(state.entrypoint)
      LOG.info(LOG_RUN_LINK, id, 'run initialization complete')
      return { id, startId, bundle }
    }

    LOG.info(LOG_RUN_LINK, id, 'checking minver')
    const updating = await app.minver()
    if (updating) LOG.info(LOG_RUN_LINK, id, 'minver updating:', !!updating)
    else LOG.info(LOG_RUN_LINK, id, 'app bundling..')
    const bundle = await app.bundle.bundle(state.entrypoint)
    LOG.info(LOG_RUN_LINK, id, 'run initialization complete')
    return { id, startId, bundle }
    // start is tied to the lifecycle of the client itself so we don't tear it down
  }

  async #updatePearInterface (drive) {
    try {
      const pkgEntry = await drive.entry('/package.json')
      if (pkgEntry === null) return
      const pkg = JSON.parse(await drive.get(pkgEntry))
      const isDevDep = !!pkg.devDependencies?.['pear-interface']
      if (isDevDep === false) return
      const pearInterfacePkgEntry = await drive.entry('/node_modules/pear-interface/package.json')
      if (pearInterfacePkgEntry === null) return
      const projPkg = JSON.parse(await drive.get(pearInterfacePkgEntry))
      const platPkg = JSON.parse(await this.drive.get('/node_modules/pear-interface/package.json'))
      if (projPkg.version === platPkg.version) return
      const tmp = path.join(drive.root, 'node_modules', '.pear-interface.next')
      const mirror = this.drive.mirror(new LocalDrive(tmp), { prefix: '/node_modules/pear-interface' })
      await mirror.done()
      const next = path.join(tmp, 'node_modules', 'pear-interface')
      const current = path.join(drive.root, 'node_modules', 'pear-interface')
      await fsx.swap(next, current)
      await fs.promises.rm(tmp, { recursive: true })
    } catch (err) {
      LOG.error('internal', 'Unexpected error while attempting to update pear-interface in project', drive.root, err)
    }
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
    if (this.dhtBootstrap) LOG.info('sidecar', 'DHT bootstrap set', this.dhtBootstrap)
    const knownNodes = await this.model.getDhtNodes()
    const nodes = this.dhtBootstrap ? undefined : knownNodes
    if (nodes) {
      LOG.info('sidecar', '- DHT known-nodes read from database ' + nodes.length + ' nodes')
      LOG.trace('sidecar', nodes.map(node => `  - ${node.host}:${node.port}`).join('\n'))
    }
    this.swarm = new Hyperswarm({ keyPair: this.keyPair, bootstrap: this.dhtBootstrap, nodes })
    this.swarm.once('close', () => { this.swarm = null })
    this.swarm.on('connection', (connection) => { this.corestore.replicate(connection) })
    if (this.replicator !== null) this.replicator.join(this.swarm, { server: false, client: true }).catch(safetyCatch)
  }

  _getCorestore (name, channel, opts) {
    if (!name || !channel) return this.corestore.session({ writable: false, ...opts })
    return this.corestore.namespace(`${name}~${channel}`, { writable: false, ...opts })
  }

  async #shutdown (client) {
    LOG.info('sidecar', '- Sidecar Shutting Down...')
    const app = client.userData
    const tearingDown = !!app && app.teardown()
    if (tearingDown === false) this.#teardownPipelines(client).then(() => client.close())

    this.spindownms = 0
    const restarts = this.closeClients()

    this.spindownms = 0
    this.#spindownCountdown()
    await this.closing
    return restarts
  }

  async #close () {
    await this.applings.close()
    clearTimeout(this.lazySwarmTimeout)
    if (this.replicator) await this.replicator.leave(this.swarm)
    if (this.swarm) {
      if (!this.dhtBootstrap) {
        const knownNodes = this.swarm.dht.toArray({ limit: KNOWN_NODES_LIMIT })
        if (knownNodes.length) {
          await this.model.setDhtNodes(knownNodes)
          LOG.info('sidecar', '- DHT known-nodes wrote to database ' + knownNodes.length + ' nodes')
          LOG.trace('sidecar', knownNodes.map(node => `  - ${node.host}:${node.port}`).join('\n'))
        }
      }
      await this.swarm.destroy()
    }
    if (this.corestore) await this.corestore.close()
    await this.model.close()
    LOG.info('sidecar', LOG.CHECKMARK + ' Sidecar Closed')
  }

  async _close () {
    if (this.decomissioned) return
    this.decomissioned = true
    for (const client of this.clients) await this.#teardownPipelines(client)
    // point of no return, death-march ensues
    this.deathClock()
    const closing = this.#close()
    this.closeClients()
    await closing
    await this.ipc.close()

    if (this.updater) {
      if (await this.updater.applyUpdate() !== null) {
        LOG.info('sidecar', LOG.CHECKMARK + ' Applied update')
      }
    }
  }

  _generateAppStorage (parsedLink) {
    const appStorage = path.join(PLATFORM_DIR, 'app-storage')
    return parsedLink.protocol !== 'pear:'
      ? path.join(appStorage, 'by-random', crypto.randomBytes(16).toString('hex'))
      : path.join(appStorage, 'by-dkey', crypto.discoveryKey(hypercoreid.decode(parsedLink.drive.key)).toString('hex'))
  }

  deathClock (ms = 20000) {
    clearTimeout(this.bailout)
    this.bailout = setTimeout(() => {
      LOG.error('internal', 'DEATH CLOCK TRIGGERED, FORCE KILLING. EXIT CODE 124')
      Bare.exit(124) // timeout
    }, ms).unref()
  }
}

function pickData () {
  return new streamx.Transform({
    transform ({ data }, cb) {
      cb(null, data)
    }
  })
}

module.exports = Sidecar
