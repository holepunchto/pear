'use strict'
const fs = require('bare-fs')
const path = require('bare-path')
const { spawn, spawnSync } = require('bare-subprocess')
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
const { isMac, isWindows } = require('which-runtime')
const { command } = require('paparam')
const reports = require('./lib/reports')
const Store = require('./lib/store')
const Applings = require('./lib/applings')
const Bundle = require('./lib/bundle')
const Replicator = require('./lib/replicator')
const Http = require('./lib/http')
const Session = require('./lib/session')
const registerUrlHandler = require('../../url-handler')
const parseLink = require('../../lib/parse-link')
const runDefinition = require('../../run/definition')
const { version } = require('../../package.json')
const deriveEncryptionKey = require('pw-to-ek')
const {
  PLATFORM_DIR, PLATFORM_LOCK, SOCKET_PATH, CHECKOUT, APPLINGS_PATH,
  SWAP, RUNTIME, DESKTOP_RUNTIME, ALIASES, SPINDOWN_TIMEOUT, WAKEUP, SALT
} = require('../../constants')
const { ERR_INTERNAL_ERROR, ERR_PERMISSION_REQUIRED } = require('../../errors')
const identity = new Store('identity')
const encryptionKeys = new Store('encryption-keys')
const SharedState = require('../../state')
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

class PermitStore extends Store {
  async get (key) {
    return await super.get(key) || await preferences.get(key)
  }
}

const permits = new PermitStore('permits')

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
  electronVersion = null

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
    if (params.startId) {
      const starting = this.running.get(params.startId)
      if (starting) client.userData = starting.client.userData
      else throw ERR_INTERNAL_ERROR('identify failure unrecognized startId (check crash logs)')
    }
    if (!client.userData) throw ERR_INTERNAL_ERROR('identify failure no userData (check crash logs)')
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
    if (!this.electronVersion) {
      const args = ['-p', 'global.process.versions.electron']
      const subprocess = spawnSync(DESKTOP_RUNTIME, args, { env: { ELECTRON_RUN_AS_NODE: '1' } })
      if (!subprocess.error) this.electronVersion = subprocess.stdout.toString().trim()
    }

    const runtimes = { bare: Bare.versions.bare, pear: version, electron: this.electronVersion }
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

  async permit (params) {
    if (params.password || params.encryptionKey) {
      const encryptionKey = params.encryptionKey || await deriveEncryptionKey(params.password, SALT)
      const encryptionKeys = await permits.get('encryption-keys') || {}
      encryptionKeys[hypercoreid.normalize(params.key)] = encryptionKey.toString('hex')
      await permits.set('encryption-keys', encryptionKeys)
    }
    const trusted = new Set((await permits.get('trusted')) || [])
    if (params.key !== null) {
      const z32 = hypercoreid.encode(params.key)
      trusted.add(z32)
    }
    return permits.set('trusted', Array.from(trusted))
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
      if (tearingDown === false) client.close()
    }
    return metadata
  }

  async restart ({ platform = false, hard = true } = {}, client) {
    if (this.verbose) console.log(`${hard ? 'Hard' : 'Soft'} restarting ${platform ? 'platform' : 'client'}`)
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

    if (!hard && this.hasClients) {
      const seen = new Set()
      for (const { userData: app } of this.clients) {
        if (!app.state || seen.has(app.state.id)) continue
        seen.add(app.state.id)
        app.message({ type: 'pear/reload' })
      }
    }

    const sidecarClosed = new Promise((resolve) => this.corestore.once('close', resolve))
    let restarts = await this.#shutdown(client)
    // ample time for any OS cleanup operations:
    await new Promise((resolve) => setTimeout(resolve, 1500))
    // shutdown successful, reset death clock
    this.deathClock()

    if (!hard) return

    restarts = restarts.filter(({ run }) => run)
    if (restarts.length === 0) return
    if (this.verbose) console.log('Restarting', restarts.length, 'apps')

    await sidecarClosed

    for (const { cwd, dir, appling, cmdArgs, env, options } of restarts) {
      const opts = { cwd, env, detached: true, stdio: 'ignore' }
      if (appling) {
        const applingPath = typeof appling === 'string' ? appling : appling?.path
        if (isMac) spawn('open', [applingPath.split('.app')[0] + '.app'], opts).unref()
        else spawn(applingPath, opts).unref()
      } else {
        const TARGET_RUNTIME = this.updater === null
          ? (options?.type === 'terminal' ? RUNTIME : DESKTOP_RUNTIME)
          : this.updater.swap + (options?.type === 'terminal' ? RUNTIME : DESKTOP_RUNTIME).slice(SWAP.length)

        const cmd = command('run', ...runDefinition)
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
        const fragment = parsed.hash ? parsed.hash.slice(1) : (SharedState.isKeetInvite(segment) ? segment : null)
        app.message({ type: 'pear/wakeup', link, applink: app.state.applink, entrypoint: pathname, fragment, linkData: segment })
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

    const running = this.#start(flags, client, session, env, cwd, link, dir, startId, args, cmdArgs)
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

  async #start (flags, client, session, env, cwd, link, dir, startId, args, cmdArgs) {
    const id = client.userData?.id || `${client.id}@${startId}`
    const app = client.userData = client.userData?.id ? client.userData : new this.App({ id, startId, session })
    const state = new State({ id, env, link, dir, cwd, flags, args, cmdArgs, run: true })

    let encryptionKey
    if (flags.encryptionKey) {
      encryptionKey = (await encryptionKeys.get(flags.encryptionKey))
      encryptionKey = encryptionKey ? Buffer.from(encryptionKey, 'hex') : null
    } else {
      const { drive } = parseLink(link)
      let storedEncryptedKey
      if (drive.key) {
        const encryptionKeys = await permits.get('encryption-keys') || {}
        storedEncryptedKey = encryptionKeys[hypercoreid.normalize(drive.key)]
      } else {
        storedEncryptedKey = null
      }
      encryptionKey = storedEncryptedKey ? Buffer.from(storedEncryptedKey, 'hex') : null
    }

    const applingPath = state.appling?.path
    if (applingPath && state.key !== null) {
      const applingKey = state.key.toString('hex')
      await this.applings.set(applingKey, applingPath)
    }

    app.state = state

    await this.ready()

    if (state.key === null) {
      const drive = new LocalDrive(state.dir, { followLinks: true })
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

      await session.add(appBundle)

      app.linker = linker
      app.bundle = appBundle

      // app is locally run (therefore trusted), refresh trust for any updated configured link keys:
      await this.permit({ key: state.key }, client)

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

    if (!flags.trusted) {
      const aliases = Object.values(ALIASES).map(hypercoreid.encode)
      const trusted = new Set([...aliases, ...((await permits.get('trusted')) || [])])
      const z32 = hypercoreid.encode(state.key)
      if (trusted.has(z32) === false) {
        const err = new ERR_PERMISSION_REQUIRED('Permission required to run key', { key: state.key })
        app.report({ err })
        return { startId, bail: err }
      }
    }

    // if app is being staged, stage command sends over its client id, so tracer
    // can get the bundle from that client for tracer data:
    const trace = typeof state.trace !== 'undefined'
      ? this.ipc.client(state.trace).userData.bundle.tracer
      : null

    // check for drive encryption, only throws if the drive has been previously replicated
    const corestore = this._getCorestore(state.manifest?.name, state.channel)
    let drive
    try {
      drive = new Hyperdrive(corestore, state.key, { encryptionKey })
      await drive.ready()
    } catch {
      const err = new ERR_PERMISSION_REQUIRED('Encryption key required', { key: state.key, encrypted: true })
      app.report({ err })
      return { startId, bail: err }
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
      trace,
      drive,
      updateNotify: state.updates && ((version, info) => this.updateNotify(version, info)),
      async failure (err) { app.report({ err }) }
    })

    await session.add(appBundle)

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
        const bail = new ERR_PERMISSION_REQUIRED('Encryption key required', { key: state.key, encrypted: true })
        app.report({ err: bail })
        return { startId, bail }
      } else {
        await session.close()
        throw err
      }
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
      console.error('Unexpected error while attempting to update pear-interface in project', drive.root, err)
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
