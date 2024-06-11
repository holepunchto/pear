'use strict'
const fs = require('bare-fs')
const path = require('bare-path')
const { spawn } = require('bare-subprocess')
const streamx = require('streamx')
const ReadyResource = require('ready-resource')
const ScriptLinker = require('script-linker')
const LocalDrive = require('localdrive')
const Hyperswarm = require('hyperswarm')
const hypercoreid = require('hypercore-id-encoding')
const crypto = require('hypercore-crypto')
const Iambus = require('iambus')
const safetyCatch = require('safety-catch')
const sodium = require('sodium-native')
const Updater = require('pear-updater')
const IPC = require('pear-ipc')
const { isMac, isWindows } = require('which-runtime')
const reports = require('./lib/reports')
const Store = require('./lib/store')
const Applings = require('./lib/applings')
const Bundle = require('./lib/bundle')
const Replicator = require('./lib/replicator')
const Http = require('./lib/http')
const Session = require('./lib/session')
const registerUrlHandler = require('../../url-handler')
const parseLink = require('../../run/parse-link')
const { command } = require('paparam')
const runDefinition = require('../../run/definition')

const {
  PLATFORM_DIR, PLATFORM_LOCK, SOCKET_PATH, CHECKOUT, APPLINGS_PATH,
  SWAP, RUNTIME, DESKTOP_RUNTIME, ALIASES, SPINDOWN_TIMEOUT, WAKEUP
} = require('../../constants')

const { ERR_INTERNAL_ERROR, ERR_INVALID_PACKAGE_JSON, ERR_PERMISSION_REQUIRED } = require('../../errors')
const identity = new Store('identity')
const encryptionKeys = new Store('encryption-keys')
const State = require('./state')
const { preferences } = State
const ops = {
  GC: require('./ops/gc'),
  Release: require('./ops/release'),
  Stage: require('./ops/stage'),
  Seed: require('./ops/seed'),
  Dump: require('./ops/dump'),
  Info: require('./ops/info'),
  Shift: require('./ops/shift'),
  EncryptionKey: require('./ops/encryption-key')
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

  constructor ({ updater, drive, corestore, gunk, verbose = false }) {
    super()
    this.bus = new Iambus()
    this.version = CHECKOUT

    this.updater = updater
    if (this.updater) this.updater.on('update', (checkout) => this.updateNotify(checkout))

    this.#spindownCountdown()

    this.drive = drive
    this.corestore = corestore
    this.gunk = gunk
    this.verbose = verbose

    this.ipc = new IPC({
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

    this.http = new Http(this)
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
            console.warn('Specified minver key', minver.key, ' does not match current version key', current.key, '. Ignoring.\nminver:', minver, '\ncurrent:', this.version)
          } else if (typeof minver.length !== 'number') {
            console.warn(`Invalid minver (length is required). Ignoring. minver: ${minver.fork}.${minver.length}.${minver.key}`)
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
      this.ready().catch((err) => console.error(err))
    }, SWARM_DELAY)
  }

  async _open () {
    await this.applings.set('runtime', DESKTOP_RUNTIME)
    await this.http.ready()
    await this.#ensureSwarm()
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
      if (this.hasClients) return
      this.close().catch(console.error)
    }, this.spindownms)
  }

  async updateNotify (version, info = {}) {
    this.spindownms = 0
    this.updateAvailable = { version, info }

    if (this.verbose) {
      if (info.link) {
        console.log('Application update available:')
      } else if (version.force) {
        console.log('Platform Force update (' + version.force.reason + '). Updating to:')
      } else {
        console.log('Platform update Available. Restart to update to:')
      }
      console.log(' v' + version.fork + '.' + version.length + '.' + version.key + (info.link ? ' (' + info.link + ')' : ''))
    }

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

  get host () { return this.http?.host || null }
  get port () { return this.http?.port || null }

  async address () {
    await this.http.ready()
    return this.host
  }

  async identify (params, client) {
    if (!client.userData && params.startId) {
      const starting = this.running.get(params.startId)
      if (starting) client.userData = starting.client.userData
      else throw ERR_INTERNAL_ERROR('identify failure unrecognized startId (check crash logs)')
    }
    const id = client.userData.id
    const host = await this.address()
    return { host, id }
  }

  seed (params, client) { return new ops.Seed(params, client, this) }

  release (params, client) { return new ops.Release(params, client, this) }

  stage (params, client) { return new ops.Stage(params, client, this) }

  dump (params, client) { return new ops.Dump(params, client, this) }

  info (params, client) { return new ops.Info(params, client, this) }

  shift (params, client) { return new ops.Shift(params, client, this) }

  gc (params, client) { return new ops.GC(params, client) }

  encryptionKey (params, client) { return new ops.EncryptionKey(params, client) }

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
    return { platform: this.version, app: client.userData?.state?.version }
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

  async config (params, client) {
    if (!client.userData) return
    const cfg = client.userData.state.constructor.configFrom(client.userData.state)
    return cfg
  }

  async checkpoint (params, client) {
    if (!client.userData) return
    await fs.promises.writeFile(path.join(client.userData.state.storage, 'checkpoint'), params)
  }

  async requestIdentity ({ publicKey }) {
    let keyPair = await identity.get('keyPair')
    if (keyPair) {
      keyPair.publicKey = Buffer.from(Object.values(keyPair.publicKey))
    } else {
      keyPair = await crypto.keyPair(publicKey.buffer)
      identity.set('keyPair', keyPair)
    }
    return keyPair.publicKey
  }

  async shareIdentity (params) {
    const { publicKey, attestation } = params
    identity.set('publicKey', publicKey)
    identity.set('attestation', attestation)
  }

  async clearIdentity () {
    identity.clear()
  }

  async message (params, client) {
    if (!client.userData) return
    return client.userData.message(params)
  }

  messages (pattern, client) {
    if (!client.userData) return
    return client.userData.messages(pattern)
  }

  async trust (key, client) {
    const trusted = new Set((await preferences.get('trusted')) || [])
    const z32 = hypercoreid.encode(key)
    trusted.add(z32)
    let pkg = null
    try {
      await client.userData.bundle.ready()
      pkg = JSON.parse(await client.userData.bundle.drive.get('/package.json'))
    } catch (err) {
      if (err instanceof SyntaxError) throw ERR_INVALID_PACKAGE_JSON('Package.json parsing error, invalid JSON')
      console.error('Unexpected error while attempting trust', err)
      return await preferences.set('trusted', Array.from(trusted))
    }
    if (typeof pkg?.pear?.links === 'object' && pkg.pear.links !== null) {
      for (const link of Object.values(pkg.pear.links).filter((link) => link.startsWith('pear:'))) {
        if (parseLink(link).drive.key === null) continue
        try {
          trusted.add(hypercoreid.encode(hypercoreid.decode(link)))
        } catch {
          console.error('Invalid link encountered when attempting trust', { link })
        }
      }
    }
    return await preferences.set('trusted', Array.from(trusted))
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

  get uniqueClients () {
    if (this.hasClients === false) return []

    const uniqueClients = []
    const seen = new Set()
    for (const client of this.clients) {
      const app = client.userData
      if (!app || !app.state) continue // ignore e.g. `pear sidecar` cli i/o client
      if (seen.has(app.state.id)) continue
      seen.add(app.state.id)

      uniqueClients.push(client)
    }

    return uniqueClients
  }

  closeClients () {
    const metadata = []
    for (const client of this.uniqueClients) {
      const app = client.userData

      const { pid, cmdArgs, cwd, dir, runtime, appling, env, run, options } = app.state
      metadata.push({ pid, cmdArgs, cwd, dir, runtime, appling, env, run, options })
      const tearingDown = app.teardown()
      if (tearingDown === false) client.close()
    }
    return metadata
  }

  async restart ({ platform = false, hard = false } = {}, client) {
    if (this.verbose) console.log('Restarting ' + (platform ? 'platform' : 'client'))
    if (platform === false) {
      const { dir, cwd, cmdArgs, env } = client.userData.state
      const appling = client.userData.state.appling
      const opts = { cwd, env, detached: true, stdio: 'ignore' }
      if (!client.closed) {
        await new Promise((resolve) => {
          if (client.closed) {
            resolve()
            return
          }
          client.once('close', resolve)
          const app = client.userData
          const tearingDown = !!app && app.teardown()
          if (tearingDown === false) client.close()
        })
      }
      if (appling) {
        const applingPath = typeof appling === 'string' ? appling : appling?.path
        if (isMac) spawn('open', [applingPath.split('.app')[0] + '.app'], opts).unref()
        else spawn(applingPath, opts).unref()
      } else {
        const cmd = command('run', ...runDefinition)
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

    if (!hard) {
      const clients = this.uniqueClients.filter(c => c?.userData?.state?.options?.type === 'terminal')
      if (this.verbose) console.log(`Soft-restarting ${clients.length} terminal app(s)`)
      for (const client of clients) client.userData.message({ type: 'pear/restart' })

      // Wait for 'pear/restart' messages to send and get handled by clients
      // TODO: Figure out how to cleanly flush this buffer
      await new Promise(resolve => setTimeout(resolve, 1500))
    }

    const sidecarClosed = new Promise((resolve) => this.corestore.once('close', resolve))
    const restarts = (await this.#shutdown(client))
      .filter(({ run, options }) => run && (options?.type !== 'terminal' || hard))
    // ample time for any OS cleanup operations:
    await new Promise((resolve) => setTimeout(resolve, 1500))
    // shutdown successful, reset death clock
    this.deathClock()
    if (restarts.length === 0) return
    if (this.verbose) console.log('Restarting', restarts.length, 'apps')

    await sidecarClosed

    const TERMINAL_RUNTIME = RUNTIME
    for (const { cwd, dir, appling, cmdArgs, env, options } of restarts) {
      const opts = { cwd, env, detached: true, stdio: 'ignore' }
      if (appling) {
        const applingPath = typeof appling === 'string' ? appling : appling?.path
        if (isMac) spawn('open', [applingPath.split('.app')[0] + '.app'], opts).unref()
        else spawn(applingPath, opts).unref()
      } else {
        const RUNTIME = this.updater === null
          ? (options?.type === 'terminal' ? TERMINAL_RUNTIME : DESKTOP_RUNTIME)
          : this.updater.swap + (options?.type === 'terminal' ? TERMINAL_RUNTIME : DESKTOP_RUNTIME).slice(SWAP.length)

        const cmd = command('run', ...runDefinition)
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
          : hypercoreid.encode(app.state.key) === hypercoreid.encode(parsed.drive.key)
        )
      })

      for (const app of matches) {
        const pathname = isWindows ? path.normalize(parsed.pathname.slice(1)) : parsed.pathname
        app.message({ type: 'pear/wakeup', link, applink: app.state.applink, entrypoint: pathname, linkData: pathname })
      }

      const min = selfwake ? 1 : 0
      resolve(matches.length > min)
    })
  }

  unloading (params, client) { return client.userData.unloading() }

  async start (params, client) {
    const { flags, env, cwd, link, dir, args, cmdArgs } = params
    let { startId } = params
    const starting = this.running.get(startId)
    if (starting) {
      client.userData = starting.client.userData
      return await starting.running
    }
    if (startId && !starting) throw ERR_INTERNAL_ERROR('start failure unrecognized startId')
    const session = new Session(client)
    startId = client.userData?.startId || crypto.randomBytes(16).toString('hex')
    const encryptionKey = !flags.encryptionKey ? null : await encryptionKeys.get(flags.encryptionKey)
    const running = this.#start(encryptionKey, flags, client, session, env, cwd, link, dir, startId, args, cmdArgs)
    this.running.set(startId, { client, running })
    session.teardown(() => {
      const free = this.running.get(startId)
      if (free.running === running) {
        this.running.delete(startId)
      }
    })

    try {
      const info = await running
      if (this.updateAvailable !== null) {
        const { version, info } = this.updateAvailable
        client.userData.message({ type: 'pear/updates', version, diff: info.diff })
      }
      return info
    } catch (err) {
      await session.close()
      throw err
    }
  }

  async #start (encryptionKey, flags, client, session, env, cwd, link, dir, startId, args, cmdArgs) {
    const id = client.userData?.id || `${client.id}@${startId}`
    const app = client.userData = client.userData || new this.App({ id, startId, session })
    const state = new State({ id, env, link, dir, cwd, flags, args, cmdArgs, run: true })

    const applingPath = state.appling?.path
    if (applingPath && state.key !== null) {
      const applingKey = state.key.toString('hex')
      await this.applings.set(applingKey, applingPath)
    }

    app.state = state

    await this.ready()

    if (state.key === null) {
      const drive = new LocalDrive(state.dir, { followLinks: true })
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

      await session.add(appBundle)

      app.linker = linker
      app.bundle = appBundle
      try {
        await state.initialize({ bundle: appBundle, app, staging: true })
      } catch (err) {
        if (err.code === 'ERR_CONNECTION') app.report({ err })
      }
      const updating = await app.minver()
      const type = state.type
      const bundle = type === 'terminal' ? await app.bundle.bundle(state.entrypoint) : null
      return { port: this.port, id, startId, host: `http://127.0.0.1:${this.port}`, bail: updating, type, bundle }
    }

    const aliases = Object.values(ALIASES).map(hypercoreid.encode)
    const trusted = new Set([...aliases, ...((await preferences.get('trusted')) || [])])
    const z32 = hypercoreid.encode(state.key)
    if (trusted.has(z32) === false) {
      const err = ERR_PERMISSION_REQUIRED('Permission required to run key')
      err.trusted = Array.from(trusted)
      err.z32 = z32
      err.key = state.key
      app.report({ err })
      return { startId, bail: err }
    }

    // if app is being staged, stage command sends over its client id, so tracer
    // can get the bundle from that client for tracer data:
    const trace = typeof state.trace !== 'undefined'
      ? this.ipc.client(state.trace).userData.bundle.tracer
      : null

    const appBundle = new Bundle({
      encryptionKey,
      corestore: this._getCorestore(state.manifest?.name, state.channel),
      appling: state.appling,
      channel: state.channel,
      checkout: state.checkout,
      key: state.key,
      name: state.manifest?.name,
      dir: state.key ? null : state.dir,
      updatesDiff: state.updatesDiff,
      trace,
      updateNotify: state.updates && ((version, info) => this.updateNotify(version, info)),
      async failure (err) { app.report({ err }) }
    })

    await session.add(appBundle)

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

    // app is trusted, refresh trust for any updated configured link keys:
    await this.trust(state.key, client)

    if (this.swarm) appBundle.join(this.swarm)

    try {
      await appBundle.calibrate()
    } catch (err) {
      await session.close()
      throw err
    }

    const initializing = state.initialize({ bundle: appBundle, app })
    try {
      await initializing
    } catch (err) {
      if (err.code === 'ERR_CONNECTION') app.report({ err })
    }
    if (appBundle.platformVersion !== null) {
      app.report({ type: 'upgrade' })
      const type = state.type
      const bundle = type === 'terminal' ? await app.bundle.bundle(state.entrypoint) : null
      return { port: this.port, id, startId, host: `http://127.0.0.1:${this.port}`, type, bundle }
    }

    const updating = await app.minver()

    // start is tied to the lifecycle of the client itself so we don't tear it down now
    const type = state.type

    const bundle = type === 'terminal' ? await app.bundle.bundle(state.entrypoint) : null
    return { port: this.port, id, startId, host: `http://127.0.0.1:${this.port}`, bail: updating, type, bundle }
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
    this.swarm = new Hyperswarm({ keyPair: this.keyPair })
    this.swarm.once('close', () => { this.swarm = null })
    this.swarm.on('connection', (connection) => { this.corestore.replicate(connection) })
    if (this.replicator !== null) this.replicator.join(this.swarm, { server: false, client: true }).catch(safetyCatch)
  }

  _getCorestore (name, channel, opts) {
    if (!name || !channel) return this.corestore.session({ writable: false, ...opts })
    return this.corestore.namespace(`${name}~${channel}`, { writable: false, ...opts })
  }

  // DEPRECATED - assess for removal from Sep 2024
  async * preferences () {
    for await (const { data } of preferences.updates()) yield data
  }

  async setPreference ({ key, value }) {
    const result = await preferences.set(key, value)
    return result
  }

  async getPreference ({ key }) {
    return await preferences.get(key)
  }

  async * iteratePreferences () {
    yield * preferences.entries()
  }

  async #shutdown (client) {
    if (this.verbose) console.log('- Sidecar shutting down...')
    const app = client.userData
    const tearingDown = !!app && app.teardown()
    if (tearingDown === false) client.close()

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
    if (this.http) await this.http.close()
    if (this.swarm) await this.swarm.destroy()
    if (this.corestore) await this.corestore.close()
    if (this.verbose) console.log((isWindows ? '^' : '✔') + ' Sidecar closed')
  }

  async _close () {
    if (this.decomissioned) return
    this.decomissioned = true
    // point of no return, death-march ensues
    this.deathClock()
    const closing = this.#close()
    this.closeClients()
    await closing
    await this.ipc.close()

    if (this.updater) {
      if (await this.updater.applyUpdate() !== null) {
        if (this.verbose) console.log((isWindows ? '^' : '✔') + ' Applied update')
      }
    }
  }

  deathClock (ms = 20000) {
    clearTimeout(this.bailout)
    this.bailout = setTimeout(() => {
      console.error('DEATH CLOCK TRIGGERED, FORCE KILLING. EXIT CODE 124')
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
