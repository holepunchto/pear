'use strict'
const http = require('bare-http1')
const fs = require('bare-fs')
const path = require('bare-path')
const { spawn } = require('bare-subprocess')
const { once } = require('bare-events')
const { pipelinePromise: pipeline } = require('streamx')
const ReadyResource = require('ready-resource')
const ScriptLinker = require('script-linker')
const LocalDrive = require('localdrive')
const Mirror = require('mirror-drive')
const Hyperswarm = require('hyperswarm')
const unixPathResolve = require('unix-path-resolve')
const hypercoreid = require('hypercore-id-encoding')
const { randomBytes } = require('hypercore-crypto')
const Iambus = require('iambus')
const safetyCatch = require('safety-catch')
const sodium = require('sodium-native')
const Mime = require('./mime')
const gunk = require('./gunk')
const reports = require('./reports')
const preferences = require('./preferences')
const Applings = require('./applings')
const Bundle = require('./bundle')
const Replicator = require('./replicator')
const Context = require('../ctx/sidecar')
const { CHECKOUT, BOOT, SWAP, APPLINGS_PATH, RUNTIME, DESKTOP_RUNTIME } = require('./constants')
const { isBare } = require('which-runtime')
const ENV = isBare ? require('bare-env') : process.env
const mime = new Mime()
const SWARM_DELAY = 5000

class Session {
  constructor (client) {
    this.client = client
    this.resources = new Set()

    this._eagerTeardownBound = this._eagerTeardown.bind(this)
    this._tearingDown = null
    this._teardowns = []
    client.on('close', this._eagerTeardownBound)
  }

  get closed () {
    return this.client.closed
  }

  async add (resource) {
    await resource.ready()

    if (this.closed) {
      await resource.close()
      throw new Error('Session is closed')
    }

    this.resources.add(resource)
    return resource
  }

  async delete (resource) {
    this.resources.delete(resource)
    await resource.close()
  }

  close () {
    this._eagerTeardown()
    return this._tearingDown
  }

  _eagerTeardown () {
    if (this._tearingDown) return
    this.client.off('close', this._eagerTeardownBound)
    this._tearingDown = this._teardown()
    this._tearingDown.catch(safetyCatch)
  }

  teardown (fn) {
    this._teardowns.push(fn)
  }

  async _teardown () {
    const closing = []
    for (const resource of this.resources) {
      const close = resource.close()
      closing.push(close)
    }
    for (const fn of this._teardowns) {
      closing.push(fn())
    }
    for (const { status, reason } of await Promise.allSettled(closing)) {
      if (status === 'rejected') throw reason
    }
  }
}

class AppLinker extends ScriptLinker {
  constructor (drive, options = {}) {
    const {
      builtins = gunk.builtins,
      map = gunk.app.map,
      mapImport = gunk.app.mapImport,
      symbol = gunk.app.symbol,
      protocol = gunk.app.protocol,
      runtimes = gunk.app.runtimes,
      ...opts
    } = options
    super(drive, {
      builtins,
      map,
      mapImport,
      symbol,
      protocol,
      runtimes,
      ...opts
    })
  }
}

class Engine extends ReadyResource {
  bus = new Iambus()
  version = CHECKOUT
  server = null
  port = null
  host = null
  serving = null
  swarm = null
  keyPair = null
  discovery = null
  constructor (sidecar, { updater, drive, corestore }) {
    super()
    this.updater = updater
    this.corestore = corestore
    this.drive = drive
    this.replicator = updater ? new Replicator(updater.drive, { appling: true }) : null
    this.linker = new ScriptLinker(this.drive, {
      builtins: gunk.builtins,
      map: gunk.platform.map,
      mapImport: gunk.platform.mapImport,
      symbol: gunk.platform.symbol,
      protocol: gunk.platform.protocol,
      runtimes: gunk.platform.runtimes
    })
    this.bundle = new Bundle({ drive })
    this.sidecar = sidecar

    this.applings = new Applings(APPLINGS_PATH)

    this.server = null
    this.connections = new Set()
    this.running = new Map()

    const engine = this
    this.App = class App {
      engine = engine
      handlers = null
      linker = null
      bundle = null
      reporter = null
      reported = null
      ctx = null
      session = null
      app = null
      unload = null
      unloader = null
      minvering = false
      #mapReport (report) {
        if (report.type === 'update') return reports.update(report)
        if (report.type === 'upgrade') return reports.upgrade()
        if (report.type === 'restarting') return reports.restarting()
        if (report.err?.code === 'ERR_INVALID_LENGTH') return reports.minver(report)
        if (report.err?.code === 'ERR_CONNECTION') return reports.connection()
        if (report.err) console.error('REPORT', report.err) // send generic errors to the text error log as well
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
          } catch {}

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
        const { ctx } = this
        if (ctx.options.minver && this.engine.updater !== null) {
          this.minvering = true
          const current = {
            length: this.engine.drive.version,
            fork: this.engine.drive.fork,
            key: this.engine.drive.core.id
          }
          const minver = {
            key: hypercoreid.normalize(ctx.options.minver.key),
            length: ctx.options.minver.length,
            fork: ctx.options.minver.fork
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
              await this.engine.updater.wait(checkout)
              this.engine.sidecar.updateNotify(checkout)
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
        return this.engine.bus.pub({ topic: 'reports', id: this.id, data: this.#mapReport(report) })
      }

      notify (noti) { return this.engine.bus.pub({ topic: 'notifications', id: this.id, data: noti }) }

      warmup (data) { return this.engine.bus.pub({ topic: 'warming', id: this.id, data }) }

      message (msg) { return this.engine.bus.pub({ topic: 'messages', id: this.id, data: msg }) }

      async * messages (ptn) {
        for await (const { data } of this.engine.bus.sub({ topic: 'messages', id: this.id, ...(ptn ? { data: ptn } : {}) })) {
          yield data
        }
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

      constructor ({ id = '', startId = '', ctx = null, bundle = null, session }) {
        this.app = this
        this.session = session
        this.bundle = bundle
        this.id = id
        this.ctx = ctx
        this.warming = this.engine.bus.sub({ topic: 'warming', id: this.id })
        this.reporter = this.engine.bus.sub({ topic: 'reports', id: this.id })
        this.notifications = this.engine.bus.sub({ topic: 'notifications', id: this.id })
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
    await this.serve()
    await this.#ensureSwarm()
  }

  async lookup (app, protocol, type, req, res) {
    if (app.closed) throw new Gone()
    const { bundle, linker } = app
    const url = `${protocol}://${type}${req.url}`
    let link = null
    try { link = ScriptLinker.link.parse(url) } catch { throw new BadRequest(`Bad Request (Malformed URL: ${url})`) }

    const isImport = link.transform === 'esm' || link.transform === 'app'

    let builtin = false
    if (link.filename === null) {
      try {
        link.filename = await linker.resolve(link.resolve, link.dirname, { isImport })
      } catch (e) {
        console.error('link err', e)
        throw e
      }

      builtin = link.filename === link.resolve && linker.builtins.has(link.resolve)
    }

    let isJS = false
    if (protocol !== 'resolve') {
      const ct = mime.type(link.filename)
      res.setHeader('Content-Type', ct)
      if (link.transform === 'app') link.transform = 'esm'
      isJS = ct.slice(0, 22) === 'application/javascript'
      if (builtin) {
        res.setHeader('Content-Type', 'application/javascript; charset=utf-8')
        const out = await linker.transform(link)
        res.end(out)
        return
      }
    }

    if (await bundle.has(link.filename) === false) {
      if (link.filename === '/index.html') {
        const manifest = await bundle.db.get('manifest')
        if (typeof manifest?.value?.main === 'string') {
          req.url = `/${manifest?.value?.main}`
          return this.lookup(app, protocol, type, req, res)
        }
      }

      throw new NotFound(`Not Found: "${link.filename}"`)
    }

    if (protocol === 'resolve') {
      res.setHeader('Content-Type', 'text/plain; charset=UTF-8')
      if (!link.resolve && !link.dirname && !link.filename) throw new NotFound(`Not Found: "${req.url}"`)
      res.end(link.filename)
      return
    }

    const isSourceMap = link.transform === 'map'
    if (isJS || isSourceMap) {
      const out = await linker.transform(link)
      if (isSourceMap) res.setHeader('Content-Type', 'application/json')
      res.end(out)
    } else {
      if (protocol === 'app' && (link.filename.endsWith('.html') || link.filename.endsWith('.htm'))) {
        const mods = await linker.warmup(link.filename)
        const batch = []
        for (const [filename, mod] of mods) {
          if (mod.type === 'module') continue
          const source = mod.toCJS()
          batch.push({ filename, source })
        }
        app.warmup({ protocol, batch })
      }
      const stream = await bundle.streamFrom(link.filename)
      await pipeline(stream, res)
    }
  }

  async serve () {
    if (this.serving) return this.serving
    this.serving = this.#serve()
    return this.serving
  }

  async #serve () {
    this.server = http.createServer(async (req, res) => {
      try {
        const ua = req.headers['user-agent']
        if (ua.slice(0, 4) !== 'Pear') throw new BadRequest()
        const [url, protocol = 'app', type = 'app'] = req.url.split('+')
        req.url = (url === '/') ? '/index.html' : url
        if (protocol === 'platform-resolve' || protocol === 'holepunch') {
          return await this.lookup(this, protocol === 'platform-resolve' ? 'resolve' : protocol, type, req, res)
        }
        if (protocol !== 'app' && protocol !== 'resolve') {
          throw new BadRequest('Unknown protocol')
        }
        const id = ua.slice(5)

        if (id === 'Platform') return await this.lookup(this, 'holepunch', type, req, res)

        const [clientId, startId] = id.split('@')

        const ipcClient = this.sidecar.client(clientId)

        if (ipcClient === null) throw new BadRequest('Bad Client ID')

        const app = ipcClient.userData
        if (app.startId !== startId) throw new NotFound()
        if (app.reported?.err) throw new NotFound('Not Found - ' + (app.reported.err.code || 'ERR_UNKNOWN') + ' - ' + app.reported.err.message)
        if (app.reported && app.ctx.options.minver) {
          res.setHeader('X-Minver', `key=${app.ctx.options.minver.key}&length=${app.ctx.options.minver.length}&fork=${app.ctx.options.minver.fork}`)
          res.end()
          return
        }
        await app.bundle.ready()
        await this.lookup(app, protocol, type, req, res)
      } catch (err) {
        console.error('ERRRORR', err, req.url)
        if (err.code === 'MODULE_NOT_FOUND') {
          err.status = err.status || 404
        } else if (err.code === 'SESSION_CLOSED') {
          err.status = err.status || 503
        } else {
          console.error('Unknown Server Error', err)
          err.status = 500
        }
        res.setHeader('Content-Type', 'text/plain')
        res.statusCode = err.status
        res.end(err.message)
      }
    })

    const listening = once(this.server, 'listening')
    this.server.listen(0, '127.0.0.1')

    this.server.on('connection', (c) => {
      this.connections.add(c)
      c.on('close', () => this.connections.delete(c))
    })

    this.server.unref()

    await listening

    this.port = this.server.address().port

    this.host = `http://127.0.0.1:${this.port}`
  }

  async * seed ({ name, channel, key, verbose, seeders, dir, clientArgv } = {}, client) {
    const session = new Session(client)
    try {
      const ctx = new Context({
        id: `seeder-${randomBytes(16).toString('hex')}`,
        argv: ['--seed', `--channel=${channel}`],
        cwd: dir,
        clientArgv
      })
      ctx.key = key
      client.userData = new this.App({ ctx, session })

      yield { tag: 'seeding', data: { key, name, channel } }
      await this.ready()

      const corestore = this.#getCorestore(name, channel)

      if (key) key = hypercoreid.decode(key)
      if (await Bundle.provisioned(corestore, key) === false) {
        throw Object.assign(new Error('Pear Platform: Nothing to seed'), { code: 'ERR_BARE_CORE' })
      }

      const log = (msg) => this.bus.pub({ topic: 'seed', id: client.id, msg })
      const notices = this.bus.sub({ topic: 'seed', id: client.id })
      const bundle = new Bundle({ corestore, key, channel, log })
      await session.add(bundle)

      if (verbose) {
        yield { tag: 'meta-key', data: bundle.drive.key.toString('hex') }
        yield { tag: 'meta-discovery-key', data: bundle.drive.discoveryKey.toString('hex') }
        yield { tag: 'content-key', data: bundle.drive.contentKey.toString('hex') }
      }

      yield { tag: 'key', data: hypercoreid.encode(bundle.drive.key) }

      await bundle.join(this.swarm, { seeders, server: true })

      for await (const { msg } of notices) yield msg
    } catch (err) {
      await session.close()
      yield { tag: 'error', data: { ...err, stack: err.stack, message: err.message, code: err.code } }
    }
    // no need for teardown, seed is tied to the lifecycle of the client
  }

  async * release ({ name, channel, checkout, key }, client) {
    const channelName = channel || key
    if (key) key = hypercoreid.decode(key)
    // If channel is specified, then the bundle's drive is
    // obtained using corestore namespaces.
    // Otherwise, the key is used directly

    const session = new Session(client)

    try {
      const ctx = new Context({
        id: `releaser-${randomBytes(16).toString('hex')}`,
        argv: [`--checkout=${checkout}`, `--channel=${channel}`]
      })

      await this.ready()

      name = name || ctx.name

      yield { tag: 'releasing', data: { name, channel: channelName } }

      const corestore = this.#getCorestore(name || ctx.name, channel, { writable: true })

      const bundle = new Bundle({ corestore, channel, key })
      await session.add(bundle)

      if (await bundle.db.get('manifest') === null) {
        yield { tag: 'final', data: { reason: `The "${name}" app has not been staged on "${channel}" channel.`, success: false } }
        return
      }

      yield { tag: 'updating-to', data: { length: checkout || bundle.db.version } }

      await bundle.db.put('release', checkout || (bundle.db.feed.length + 1))

      yield { tag: 'released', data: { name, channel, length: bundle.db.feed.length } }

      yield { tag: 'final', data: { success: true } }
    } finally {
      await session.close()
    }
  }

  async * stage ({ channel, key, dir, dryRun, name, bare = false, clientArgv, ignore = '.git,.github,.DS_Store' }, client) {
    const session = new Session(client)

    let success = true
    try {
      const ctx = new Context({
        id: `stager-${randomBytes(16).toString('hex')}`,
        argv: ['--stage', `--channel=${channel}`],
        cwd: dir,
        clientArgv
      })

      await this.ready()

      if (key) key = hypercoreid.decode(key)

      const corestore = this.#getCorestore(name || ctx.name, channel, { writable: true })
      const bundle = new Bundle({
        key,
        corestore,
        channel,
        stage: true,
        failure (err) { console.error(err) }
      }
      )
      await session.add(bundle)

      client.userData = new this.App({ ctx, bundle })

      const currentVersion = bundle.version

      await ctx.initialize({ bundle, dryRun })
      const type = ctx.manifest.pear?.type || 'desktop'
      const terminalBare = type === 'terminal'
      if (terminalBare) bare = true
      if (ctx.manifest.pear?.stage?.ignore) ignore = ctx.manifest.pear.stage?.ignore
      else ignore = (Array.isArray(ignore) ? ignore : ignore.split(','))

      ignore = ignore.map((file) => unixPathResolve('/', file))

      const release = (await bundle.db.get('release'))?.value || 0

      const pearkey = 'pear://' + hypercoreid.encode(bundle.drive.key)

      yield { tag: 'staging', data: { name: ctx.name, channel: bundle.channel, key: pearkey, current: currentVersion, release } }

      if (dryRun) yield { tag: 'dry' }

      const root = unixPathResolve(ctx.cwd)
      const main = unixPathResolve('/', ctx.main)
      const src = new LocalDrive(root, { followLinks: bare === false, metadata: new Map() })
      const dst = bundle.drive
      const opts = { filter: (key) => ignore.some((path) => key.startsWith(path)) === false, dryRun, batch: true }

      const builtins = terminalBare ? gunk.bareBuiltins : gunk.builtins
      const linker = new ScriptLinker(src, { builtins })
      const entrypoints = [main, ...(ctx.manifest.pear?.stage?.entrypoints || [])].map((entry) => unixPathResolve('/', entry))
      const mods = await linker.warmup(entrypoints)

      for await (const [filename, mod] of mods) src.metadata.put(filename, mod.cache())

      const mirror = new Mirror(src, dst, opts)

      for await (const diff of mirror) {
        if (diff.op === 'add') {
          yield { tag: 'byte-diff', data: { type: 1, sizes: [diff.bytesAdded], message: diff.key } }
        } else if (diff.op === 'change') {
          yield { tag: 'byte-diff', data: { type: 0, sizes: [-diff.bytesRemoved, diff.bytesAdded], message: diff.key } }
        } else if (diff.op === 'remove') {
          yield { tag: 'byte-diff', data: { type: -1, sizes: [-diff.bytesRemoved], message: diff.key } }
        }
      }

      yield {
        files: mirror.count.files,
        add: mirror.count.add,
        remove: mirror.count.remove,
        change: mirror.count.change,
        success: true
      }

      if (dryRun || bare) {
        const reason = dryRun ? 'dry-run' : 'bare'
        yield { tag: 'skipping', data: { reason, success: true } }
      } else if (mirror.count.add || mirror.count.remove || mirror.count.change) {
        for await (const { blocks, total } of this.#trace(bundle, client)) {
          yield { tag: 'warming', data: { blocks, total } }
        }
        yield { tag: 'warming', data: { success: true } }
      } else {
        yield { tag: 'skipping', data: { reason: 'no changes', success: true } }
      }

      yield { tag: 'complete', data: { dryRun } }

      if (dryRun) return

      yield { tag: 'addendum', data: { version: bundle.version, release, channel, key: pearkey } }
    } catch ({ stack, code, message }) {
      success = false
      yield { tag: 'error', data: { stack, code, message, success } }
    } finally {
      yield { tag: 'final', data: { success } }
      await session.close()
    }
  }

  async * dump ({ key, dir, checkout }, client) {
    const session = new Session(client)
    try {
      await this.ready()
      if (key) key = hypercoreid.decode(key)
      checkout = Number(checkout)
      const corestore = this.#getCorestore(null, null)
      const bundle = new Bundle({ corestore, key, checkout })

      await session.add(bundle)

      if (this.swarm) bundle.join(this.swarm)

      const pearkey = 'pear://' + hypercoreid.encode(bundle.drive.key)

      yield {
        tag: 'dumping',
        data: { key: pearkey, dir }
      }

      try {
        await bundle.calibrate()
      } catch (err) {
        await session.close()
        throw err
      }

      const out = unixPathResolve(dir)
      const dst = new LocalDrive(out)
      const src = bundle.drive

      const mirror = new Mirror(src, dst)

      for await (const diff of mirror) {
        if (diff.op === 'add') {
          yield { tag: 'byte-diff', data: { type: 1, sizes: [diff.bytesAdded], message: diff.key } }
        } else if (diff.op === 'change') {
          yield { tag: 'byte-diff', data: { type: 0, sizes: [-diff.bytesRemoved, diff.bytesAdded], message: diff.key } }
        } else if (diff.op === 'remove') {
          yield { tag: 'byte-diff', data: { type: -1, sizes: [-diff.bytesRemoved], message: diff.key } }
        }
      }
    } catch ({ stack, code, message }) {
      yield { tag: 'error', data: { stack, code, message, success: false } }
    } finally {
      yield { tag: 'final', data: { success: true } }
      await session.close()
    }
  }

  async * #trace (bundle, client) {
    await bundle.ready()
    const tracer = bundle.startTracing()

    const sp = isBare
      ? spawn(DESKTOP_RUNTIME, [BOOT, `--trace=${client.id}`, '--run', bundle.drive.key.toString('hex'), '--swap', SWAP])
      : spawn(RUNTIME, [BOOT, `--trace=${client.id}`, '--run', bundle.drive.key.toString('hex'), '--swap', SWAP], {
        stdio: 'ignore',
        env: {
          ...ENV,
          NODE_PRESERVE_SYMLINKS: 1,
          ELECTRON_RUN_AS_NODE: ''
        }
      })

    const onclose = () => sp.kill()
    client.on('close', onclose)

    const closed = once(sp, 'exit')
    client.off('close', onclose)

    const total = bundle.drive.core.length + (bundle.drive.blobs?.core.length || 0)
    for await (const { blocks } of tracer) yield { total, blocks }

    const [status] = await closed

    if (status) {
      const err = new Error('Tracer Failed!')
      err.exitCode = status
      throw err
    }

    await bundle.finalizeTracing()
  }

  async * info ({ key } = {}, client) {
    const session = new Session(client)
    try {
      key = hypercoreid.decode(key)
      const hex = key.toString('hex')
      const z32 = hypercoreid.encode(key)
      yield { tag: 'retrieving', data: { hex, z32 } }
      await this.ready()
      const corestore = this.#getCorestore(null, null)
      const bundle = new Bundle({ corestore, key })
      await session.add(bundle)
      const { db } = bundle
      yield {
        tag: 'keys',
        data: {
          project: bundle.drive.key.toString('hex'),
          content: bundle.drive.contentKey.toString('hex'),
          discovery: bundle.drive.discoveryKey.toString('hex')
        }
      }

      const channel = (await db.get('channel'))?.value
      const release = (await db.get('release'))?.value
      const manifest = (await db.get('manifest'))?.value
      const name = manifest?.pear?.name || manifest?.holepunch?.name || manifest.name

      yield { tag: 'info', data: { channel, release, name, live: bundle.live } }
    } catch (err) {
      yield { tag: 'error', data: { ...err, stack: err.stack, message: err.message, code: err.code } }
    } finally {
      await session.close()
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

  identify (client) {
    return client.userData.id
  }

  async start (client, argv, env, cwd, startId) {
    const starting = this.running.get(startId)

    if (starting) {
      client.userData = starting.client.userData
      return await starting.running
    }

    if (startId && !starting) throw new Error('start failure unrecognized startId')
    const session = new Session(client)
    startId = client.userData?.startId || randomBytes(16).toString('hex')
    const running = this.#start(session, client, argv, env, cwd, startId)
    this.running.set(startId, { client, running })
    session.teardown(() => {
      const free = this.running.get(startId)
      if (free.running === running) this.running.delete(startId)
    })

    try {
      return await running
    } catch (err) {
      await session.close()
      throw err
    }
  }

  async #start (session, client, argv, env, cwd, startId) {
    const id = client.userData?.id || `${client.id}@${startId}`
    const app = client.userData = client.userData || new this.App({ id, startId, session })
    const distributions = await preferences.get('distributions')
    const ctx = new Context({ id, argv, env, cwd, distributions })

    const applingPath = ctx.appling?.path
    if (applingPath && ctx.dev !== true) {
      const applingKey = ctx.key.hex
      await this.applings.set(applingKey, applingPath)
    }

    app.ctx = ctx

    await this.ready()

    if (ctx.key === null) {
      const drive = new LocalDrive(unixPathResolve(ctx.cwd), { followLinks: true })
      const appBundle = new Bundle({ drive })
      const linker = new AppLinker(appBundle)

      await session.add(appBundle)

      app.linker = linker
      app.bundle = appBundle
      try {
        await ctx.initialize({ bundle: appBundle, app, staging: true })
      } catch (err) {
        if (err.code === 'ERR_CONNECTION') app.report({ err })
      }
      const updating = await app.minver()
      const type = ctx.options.type
      const bundle = type === 'terminal' ? await app.bundle.bundle() : null
      return { port: this.port, id, startId, host: `http://127.0.0.1:${this.port}`, bail: updating, type, bundle }
    }

    // if app is being staged, stage command sends over its client id, so tracer
    // can get the bundle from that client for tracer data:
    const trace = typeof ctx.trace !== 'undefined'
      ? this.sidecar.clientFrom(ctx.trace).userData.bundle.tracer
      : null

    const appBundle = new Bundle({
      corestore: this.#getCorestore(ctx.manifest?.name, ctx.channel),
      appling: ctx.appling,
      channel: ctx.channel,
      checkout: ctx.checkout,
      key: ctx.key?.hex,
      name: ctx.manifest?.name,
      dir: ctx.key ? null : ctx.cwd,
      local: ctx.local,
      trace,
      updateNotify: (version) => this.sidecar.updateNotify(version, true),
      async failure (err) { app.report({ err }) }
    })

    await session.add(appBundle)

    const linker = new AppLinker(appBundle)
    app.linker = linker
    app.bundle = appBundle

    if (this.swarm) appBundle.join(this.swarm)

    try {
      await appBundle.calibrate()
    } catch (err) {
      await session.close()
      throw err
    }

    const initializing = ctx.initialize({ bundle: appBundle, app })

    if (appBundle.platformVersion !== null) {
      app.report({ type: 'upgrade' })
      const type = ctx.options.type
      const bundle = type === 'terminal' ? await app.bundle.bundle() : null
      return { port: this.port, id, startId, host: `http://127.0.0.1:${this.port}`, type, bundle }
    }

    try {
      await initializing
    } catch (err) {
      if (err.code === 'ERR_CONNECTION') app.report({ err })
    }
    const updating = await app.minver()

    // start is tied to the lifecycle of the client itself so we don't tear it down now
    const type = ctx.options.type
    const bundle = type === 'terminal' ? await app.bundle.bundle() : null
    return { port: this.port, id, startId, host: `http://127.0.0.1:${this.port}`, bail: updating, type, bundle }
  }

  #getCorestore (name, channel, opts) {
    if (!name || !channel) return this.corestore.session({ writable: false, ...opts })
    return this.corestore.namespace(`${name}~${channel}`, { writable: false, ...opts })
  }

  async _close () {
    await this.applings.close()
    clearTimeout(this.lazySwarmTimeout)
    if (this.replicator) await this.replicator.leave(this.swarm)
    if (this.server) {
      const serverClosing = new Promise((resolve) => this.server.close(resolve))
      for (const c of this.connections) c.destroy()
      await serverClosing
    }

    if (this.swarm) await this.swarm.destroy()
    if (this.corestore) await this.corestore.close()
  }
}

class BadRequest extends Error {
  constructor (message = 'Bad Request') {
    super(message)
    this.status = 400
  }
}

class Gone extends Error {
  constructor (message = 'Gone') {
    super(message)
    this.status = 410
  }
}

class NotFound extends Error {
  constructor (message = 'Not Found') {
    super(message)
    this.status = 404
  }
}

module.exports = Engine
