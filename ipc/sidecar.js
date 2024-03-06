'use strict'
const Pipe = require('bare-pipe')
const { spawn } = require('bare-subprocess')
const { join } = require('bare-path')
const fsp = require('bare-fs/promises')
const clog = require('pear-changelog')
const Protomux = require('protomux')
const FramedStream = require('framed-stream')
const Channel = require('jsonrpc-mux')
const preferences = require('../lib/preferences')
const Engine = require('../lib/engine')
const parse = require('../lib/parse')
const { discoveryKey } = require('hypercore-crypto')
const { isWindows, isMac } = require('which-runtime')
const { SWAP, INTERNAL_UNSAFE, SPINDOWN_TIMEOUT, DESKTOP_RUNTIME, SOCKET_PATH, PLATFORM_DIR } = require('../lib/constants')

const { constructor: AGF } = async function * () {}

module.exports = class IPC {
  spindownt = null
  spindownms = SPINDOWN_TIMEOUT
  decomissioned = false
  #closed = null
  updateAvailable = null

  teardown () {
    global.Bare.exit()
  }

  constructor ({ updater, drive, corestore }) {
    this.updater = updater
    if (this.updater) {
      this.updater.on('update', (checkout) => this.updateNotify(checkout))
    }

    this.server = Pipe.createServer()
    this.connections = new Set()

    this.server.on('connection', (c) => {
      this.connections.add(c)
      c.on('close', () => this.connections.delete(c))
      const stream = new FramedStream(c)
      const client = new Channel(new Protomux(stream), this.freelist.nextId())
      this.handle(client)
      // we only use the stream for this, so always end the stream on channel close
      client.on('close', () => stream.end())
    })

    this.freelist = new Freelist()
    this.engine = new Engine(this, { updater, drive, corestore })
    let closed = null
    this.closing = new Promise((resolve) => { closed = resolve })
    this.closing.finally(() => console.log((isWindows ? '^' : '✔') + ' Sidecar closed'))
    this.#closed = closed
    this.#spindownCountdown()
  }

  async listen () {
    try {
      if (!isWindows) await fsp.unlink(SOCKET_PATH)
    } catch {}
    this.server.listen(SOCKET_PATH)
  }

  clientFrom (id) {
    return this.freelist.from(id)
  }

  handle (client) {
    this.freelist.alloc(client)
    client.once('close', () => {
      this.freelist.free(client.id)
      this.#spindownCountdown()
    })

    client.method('address', () => this.address())
    client.method('info', (params) => this.info(client, params))
    client.method('dump', (params) => this.dump(client, params))
    client.method('seed', (params) => this.seed(client, params))
    client.method('stage', (params) => this.stage(client, params))
    client.method('release', (params) => this.release(client, params))
    client.method('detached', (params) => this.detached(params))
    client.method('trust', (params) => this.trust(params))
    client.method('identify', () => this.identify(client))
    client.method('wakeup', (params) => this.wakeup(...params.args))
    client.method('sniff', (params) => this.sniff(client, ...params.args))
    client.method('start', (params) => this.start(client, ...params.args))
    client.method('restart', (params) => this.restart(client, ...params.args))
    client.method('shutdown', () => this.shutdown(client))
    client.method('closeClients', () => this.closeClients(client))
  }

  #spindownCountdown () {
    clearTimeout(this.spindownt)
    if (this.decomissioned) return
    if (this.freelist.emptied() === false) return
    this.spindownt = setTimeout(async () => {
      if (this.freelist.emptied() === false) return
      this.close().catch(console.error)
    }, this.spindownms)
  }

  get clients () { return this.freelist.alloced }

  client (id) {
    return this.freelist.from(id) || null
  }

  updateNotify (version, info = {}) {
    this.spindownms = 0
    this.updateAvailable = version

    if (info.link) {
      console.log('Application update available:')
    } else if (version.force) {
      console.log('Platform Force update (' + version.force.reason + '). Updating to:')
    } else {
      console.log('Platform update Available. Restart to update to:')
    }

    console.log('  v' + version.fork + '.' + version.length + '.' + version.key)

    this.#spindownCountdown()
    const messaged = new Set()

    for (const client of this.clients) {
      const app = client?.userData
      if (!app || (app.minvering === true && !version.force)) continue

      if (messaged.has(app)) continue
      messaged.add(app)

      if (info.link && info.link === app.bundle?.link) {
        app.notify({ type: 'pear/updates', app: true, version, diff: info.diff })
        app.message({ type: 'pear/updates', app: true, version, diff: info.diff })
        continue
      }
      app.notify({ type: 'pear/updates', app: false, version, diff: null })
      app.message({ type: 'pear/updates', app: false, version, diff: null })
    }
  }

  async address () {
    await this.engine.serve()
    return this.engine.host
  }

  async identify (client) {
    const id = this.engine.identify(client)
    const host = await this.address()
    return { host, id }
  }

  async detached ({ key, storage, appdev }) {
    if (!key) return false // ignore bad requests
    if (!storage) {
      storage = join(PLATFORM_DIR, 'app-storage', 'by-dkey', discoveryKey(Buffer.from(key.hex, 'hex')).toString('hex'))
    }

    const wokeup = await this.wakeup(key.link, storage, appdev, false)

    if (wokeup) return { wokeup, appling: null }
    const appling = (await this.engine.applings.get(key.hex)) || null

    return { wokeup, appling }
  }

  wakeup (link, storage, appdev = null, selfwake = true) {
    return new Promise((resolve) => {
      if (this.freelist.emptied()) {
        resolve(false)
        return
      }
      const parsed = parse.runkey(link)
      if (parsed.key === null && appdev === null) {
        resolve(false)
        return
      }
      const matches = [...this.freelist].filter((client) => {
        const app = client.userData
        if (!app || !app.ctx) return false
        return app.ctx.storage === storage && (appdev ? app.ctx.dir === appdev : app.ctx.key?.z32 === parsed.key?.z32)
      })

      for (const client of matches) {
        const app = client.userData
        if (!app) continue
        app.message({ type: 'pear/wakeup', data: parsed.data, link })
      }

      const min = selfwake ? 1 : 0
      resolve(matches.length > min)
    })
  }

  sniff (client, ...args) {
    return this.engine.sniff(client, ...args)
  }

  async start (client, ...args) {
    let starting = this.engine.start(client, ...args)
    const id = client.userData.id
    const handlers = new Handlers(id, client, this)

    client.method('iterable', async ({ channel, params = {}, eager = false }) => {
      try {
        if (eager === false && starting !== null) await starting
      } catch {
        // ignore, awaited in outer scope already
      }
      try {
        if (params.args?.type === 'Buffer') params.args = Buffer.from(params.args.data)
        const iterable = handlers.iterators[channel]({ params, ...client.userData, client }, ...deserializeArgs(params.args))
        this.#transmit(`${channel}:iterable`, client, iterable)
      } catch (err) {
        if (err) console.error('Iterable error on channel', channel, err)
        client.notify(`${channel}:iterable`, null) // end iterable on error
      }
    })

    const result = await starting
    const app = client.userData

    client.method('unloading', () => app.unloading())

    app.handlers = handlers
    if (this.updateAvailable) {
      const version = this.updateAvailable
      app.notify({ type: 'update', version })
    }

    starting = null
    return result
  }

  info (client, params) {
    return this.#transmit(`info:${params.id}`, client, this.engine.info(params, client), params.silent)
  }

  dump (client, params) {
    return this.#transmit(`dump:${params.id}`, client, this.engine.dump(params, client), params.silent)
  }

  seed (client, params) {
    return this.#transmit(`seed:${params.id}`, client, this.engine.seed(params, client), params.silent)
  }

  stage (client, params) {
    return this.#transmit(`stage:${params.id}`, client, this.engine.stage(params, client), params.silent)
  }

  release (client, params) {
    return this.#transmit(`release:${params.id}`, client, this.engine.release(params, client), params.silent)
  }

  async trust ({ z32 } = {}) {
    const trusted = new Set((await preferences.get('trusted')) || [])
    trusted.add(z32)
    return await preferences.set('trusted', Array.from(trusted))
  }

  async restart (client, { platform = false } = {}) {
    console.log('Restarting ' + (platform ? 'platform' : 'client'))
    if (platform === false) {
      const { cwd, runtime, argv, env } = client.userData.ctx
      const appling = client.userData.ctx.appling
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
        if (isMac) spawn('open', [appling.path.split('.app')[0] + '.app'], opts).unref()
        else spawn(appling.path, opts).unref()
      } else {
        spawn(runtime, argv, opts).unref()
      }

      return
    }

    const restarts = await this.shutdown(client)
    // ample time for any OS cleanup operations:
    await new Promise((resolve) => setTimeout(resolve, 1500))
    // shutdown successful, reset death clock
    this.deathClock()
    if (restarts.length === 0) return
    console.log('Restarting', restarts.length, 'apps')
    for (const { cwd, appling, argv, env } of restarts) {
      const opts = { cwd, env, detached: true, stdio: 'ignore' }
      if (appling) {
        if (isMac) spawn('open', [appling.path.split('.app')[0] + '.app'], opts).unref()
        else spawn(appling.path, opts).unref()
      } else {
        // TODO: TERMINAL_RUNTIME restarts
        const RUNTIME = this.updater === null ? DESKTOP_RUNTIME : this.updater.swap + DESKTOP_RUNTIME.slice(SWAP.length)
        spawn(RUNTIME, argv, opts).unref()
      }
    }
  }

  closeClients (closer = null) {
    if (this.freelist.emptied()) return []
    const metadata = []
    for (const client of this.clients) {
      if (client === closer || client === null) continue
      if (!client?.userData?.ctx) continue // ignore e.g. `pear sidecar` cli i/o client
      const app = client.userData
      const { pid, clientArgv, cwd, runtime, appling, argv, env } = app.ctx
      metadata.push({ pid, clientArgv, cwd, runtime, appling, argv, env })

      const tearingDown = !!app && app.teardown()
      if (tearingDown === false) client.close()
    }
    return metadata
  }

  async shutdown (client) {
    console.log('- Sidecar shutting down...')
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

  async close () {
    if (this.decomissioned) return
    this.decomissioned = true
    // point of no return, death-march ensues
    this.deathClock()
    const engineClosing = this.engine.close()
    this.closeClients()
    await engineClosing
    const serverClosing = new Promise((resolve) => this.server.close(resolve))
    for (const c of this.connections) c.destroy()
    await serverClosing
    if (this.updater) {
      if (await this.updater.applyUpdate() !== null) {
        console.log((isWindows ? '^' : '✔') + ' Applied update')
      }
    }
    this.#closed()
  }

  deathClock (ms = 20000) {
    clearTimeout(this.bailout)
    this.bailout = setTimeout(() => {
      console.error('DEATH CLOCK TRIGGERED, FORCE KILLING. EXIT CODE 124')
      Bare.exit(124) // timeout
    }, ms).unref()
  }

  async #transmit (channel, client, iterable, silent = false) {
    try {
      for await (const value of iterable) {
        if (client.closed) return
        if (silent === false) client.notify(channel, { value })
      }
      const { value } = await iterable.next() // handles returns
      if (value && silent === false) client.notify(channel, { value })
    } finally {
      client.notify(channel, null)
    }
  }
}

class Handlers {
  iterators = {}

  constructor (id, client, ipc) {
    this.id = id
    this.client = client
    this.ipc = ipc
    this.engine()
    this.app()
    if (INTERNAL_UNSAFE) this.internal()
  }

  handler (domain) {
    const { iterators } = this
    return ({ name } = {}, fn) => {
      if (name !== fn.name) {
        throw new Error('Internal Platform Developer Error: IPC Method name should match handler function name ' + name + ' <-> ' + fn.name + '...' + fn + '')
      }

      const { id, client } = this
      const channel = `${id}:${domain}:${name}`

      if (fn instanceof AGF) {
        iterators[channel] = fn
        return
      }

      client.method(channel, async (params) => {
        const args = deserializeArgs(params.args)
        const app = client.userData
        return fn({ params, client, app, ...app }, ...args)
      })
    }
  }

  engine () {
    const { ipc } = this
    const method = this.handler('engine')

    method({ name: 'resolve' }, async function resolve ({ ctx, linker }, req, dirname, type) {
      try {
        const dir = dirname || ctx.cwd
        const path = await linker.resolve(req, dir, { isImport: type === 'module' })
        return { path }
      } catch (err) {
        return { err: { message: err.message, stack: err.stack, code: err.code } }
      }
    })

    method({ name: 'platformResolve' }, async function platformResolve ({ ctx, engine }, req, dirname, type) {
      try {
        const dir = dirname || ctx.cwd
        const path = await engine.linker.resolve(req, dir, { isImport: type === 'module' })
        return { path }
      } catch (err) {
        return { err }
      }
    })

    method({ name: 'notifications' }, async function * notifications ({ app }) {
      for await (const { data: notification } of app.notifications) yield notification
    })

    method({ name: 'restart' }, async function restart ({ client }) {
      return ipc.restart(client, { all: true })
    })

    method({ name: 'changelog' }, async function changelog ({ engine, bundle }, version) {
      const appdev = bundle.drive.core === undefined
      const localdev = engine.drive.core === undefined
      const getlog = async (drive) => clog.parse(await drive.get('/changelog.md'))
      if (!version) return getlog(bundle.drive)
      if ((localdev && version.key === null) || (!localdev && version.key === engine.drive.core.id)) return getlog(engine.drive)
      if ((appdev && version.key === null) || (!appdev && version.key === bundle.drive.core.id)) return getlog(bundle.drive)
      throw new Error('Not Implemented')
    })
  }

  app () {
    const { ipc } = this
    const method = this.handler('app')

    method({ name: 'reconfig' }, async function * reconfig ({ app }) {
      for await (const { data } of app.reconfiguration()) yield data
    })

    method({ name: 'config' }, async function config ({ ctx }) {
      return ctx.constructor.configFrom(ctx)
    })

    method({ name: 'options' }, async function options ({ ctx }) {
      return ctx.options
    })

    method({ name: 'setPreference' }, async function setPreference (_, key, version) {
      const result = await preferences.set(key, version)
      return result
    })

    method({ name: 'getPreference' }, async function getPreference (_, key) {
      return await preferences.get(key)
    })

    method({ name: 'iteratePreferences' }, async function * iteratePreferences () {
      yield * preferences.entries()
    })

    method({ name: 'preferencesUpdates' }, async function * preferencesUpdates () {
      for await (const { data } of preferences.updates()) yield data
    })

    method({ name: 'checkpoint' }, async function checkpoint ({ ctx }, state) {
      await fsp.writeFile(join(ctx.storage, 'checkpoint'), state)
      ctx.reconfigure()
    })

    method({ name: 'message' }, async function message ({ app }, msg) {
      return app.message(msg)
    })

    method({ name: 'messages' }, async function * messages ({ app }, pattern) {
      yield * app.messages(pattern)
    })

    method({ name: 'warming' }, async function * warming ({ app }) {
      for await (const { data } of app.warming) yield data
    })

    method({ name: 'versions' }, async function versions ({ ctx, engine }) {
      return { platform: engine.version, app: ctx.version }
    })

    method({ name: 'reports' }, async function * reports ({ app }) {
      for await (const { data: report } of app.reporter) yield report
    })

    method({ name: 'createReport' }, function createReport ({ app }, err) {
      return app.report({ err: { message: err.message, stack: err.stack, code: err.code, clientCreated: true } })
    })

    method({ name: 'restart' }, async function restart ({ client }, opts = {}) {
      return ipc.restart(client, opts)
    })
  }

  internal () {
    const method = this.handler('internal')

    method({ name: 'bundledb' }, async function bundledb ({ bundle }, cmd, key, value) {
      if (cmd === 'put') return bundle.db.put(key, value)
      if (cmd === 'get') return bundle.db.get(key)
      if (cmd === 'del') return bundle.db.del(key)
    })
  }
}

class Freelist {
  alloced = []
  freed = []

  nextId () {
    return this.freed.length === 0 ? this.alloced.length : this.freed[this.freed.length - 1]
  }

  alloc (item) {
    const id = this.freed.length === 0 ? this.alloced.push(null) - 1 : this.freed.pop()
    this.alloced[id] = item
    return id
  }

  free (id) {
    this.freed.push(id)
    this.alloced[id] = null
  }

  from (id) {
    return id < this.alloced.length ? this.alloced[id] : null
  }

  emptied () {
    return this.freed.length === this.alloced.length
  }

  * [Symbol.iterator] () {
    for (const item of this.alloced) {
      if (item === null) continue
      yield item
    }
  }
}

function deserializeArgs (args) {
  if (!args) return []
  try {
    return JSON.parse(args)
  } catch (err) {
    console.error('Pear Platform: argument deserialization error', err)
  }
}
