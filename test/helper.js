'use strict'
const FramedStream = require('framed-stream')
const Protomux = require('protomux')
const JSONRPC = require('jsonrpc-mux')
const path = require('bare-path')
const { spawn } = require('bare-subprocess')
const Corestore = require('corestore')
const Hyperdrive = require('hyperdrive')
const Hyperswarm = require('hyperswarm')
const Localdrive = require('localdrive')
const fs = require('bare-fs')
const os = require('bare-os')
const fsext = require('fs-native-extensions')
const { decode } = require('hypercore-id-encoding')
const ReadyResource = require('ready-resource')
const Pipe = require('bare-pipe')
const { arch, platform, isWindows } = require('which-runtime')
const { Session } = require('pear-inspect')
const { Readable } = require('streamx')

class Helper {
  constructor (t, opts = {}) {
    this.teardown = t.teardown
    this.opts = opts
    this.logging = this.opts.logging

    this.client = null

    this.platformDir = this.opts.platformDir || path.resolve(os.cwd(), '..', 'pear')
    this.swap = this.opts.swap || path.resolve(os.cwd(), '..')

    this.socketPath = isWindows ? `\\\\.\\pipe\\${Helper.IPC_ID}` : `${this.platformDir}/${Helper.IPC_ID}.sock`
    this.bin = 'by-arch/' + platform + '-' + arch + '/bin/'
    this.runtime = path.join(this.swap, 'by-arch', platform + '-' + arch, 'bin', 'pear-runtime')

    if (this.logging) this.argv.push('--attach-boot-io')
  }

  static IPC_ID = 'pear'
  static CONNECT_TIMEOUT = 20_000

  async bootstrap () {
    this.client = await this.bootpipe()
  }

  connect () {
    return new Pipe(this.socketPath)
  }

  async bootpipe () {
    let trycount = 0
    let pipe = null
    let timedout = false
    let next = null

    const timeout = setTimeout(() => {
      timedout = true
      if (pipe) pipe.destroy()
    }, Helper.CONNECT_TIMEOUT)

    while (true) {
      const promise = new Promise((resolve) => { next = resolve })

      pipe = this.connect()
      pipe.on('connect', onconnect)
      pipe.on('error', onerror)

      if (await promise) break
      if (timedout) throw new Error('Could not connect in time')
      if (trycount++ === 0) this.tryboot()

      await new Promise((resolve) => setTimeout(resolve, trycount < 2 ? 5 : trycount < 10 ? 10 : 100))
    }

    clearTimeout(timeout)

    const framed = new FramedStream(pipe)
    const mux = new Protomux(framed)
    const channel = new JSONRPC(mux)

    channel.on('close', () => framed.end())

    return channel

    function onerror () {
      pipe.removeListener('error', onerror)
      pipe.removeListener('connect', onconnect)
      next(false)
    }

    function onconnect () {
      pipe.removeListener('error', onerror)
      pipe.removeListener('connect', onconnect)
      clearTimeout(timeout)
      next(true)
    }
  }

  tryboot () {
    const sc = spawn(this.runtime, ['--sidecar'], {
      detached: true,
      stdio: 'inherit',
      cwd: this.platformDir
    })

    sc.unref()
  }

  async open (key, { tags = [] } = {}) {
    if (!key) throw new Error('Key is missing')

    tags = ['inspector', ...tags].map(tag => ({ tag }))

    const app = await this.pick(this.run({ args: [key], dev: true, key }), { tag: 'child' })

    const iterable = new Readable({ objectMode: true })

    app.once('exit', (code, signal) => {
      iterable.push({ tag: 'exit', data: { code, signal } })
    })

    app.stdout.on('data', (data) => {
      if (data.toString().indexOf('teardown') > -1) return iterable.push({ tag: 'teardown', data: data.toString().trim() })
      iterable.push({ tag: 'inspector', data: data.toString().trim() })
    })

    const pick = this.pickMany(iterable, tags)

    const ikey = await pick.inspector
    const inspector = new Helper.Inspector(ikey)
    await inspector.ready()

    return { inspector, pick, app }
  }

  async * run ({ args, key = null, silent = false }) {
    if (key !== null) args = [...args.filter((arg) => arg !== key), 'run', `pear://${key}`]

    args = [...args, '--ua', 'pear/terminal']

    const child = spawn(this.runtime, args, {
      stdio: silent ? 'ignore' : ['pipe', 'pipe', 'inherit']
    })

    yield { tag: 'child', data: child }
  }

  start (...args) {
    return this.client.request('start', { args })
  }

  async restart (args) {
    return await this.client.request('restart', { args }, { errorlessClose: true })
  }

  async closeClients () {
    if (this.client.closed) return
    return this.client.request('closeClients')
  }

  async accessLock () {
    const pdir = this.platformDir || path.resolve(os.cwd(), '..', 'pear')
    const fd = await new Promise((resolve, reject) => fs.open(path.join(pdir, 'corestores', 'platform', 'primary-key'), 'r+', (err, fd) => {
      if (err) {
        reject(err)
        return
      }
      resolve(fd)
    }))

    const granted = fsext.tryLock(fd)
    if (granted) fsext.unlock(fd)

    return granted
  }

  async shutdown () {
    if (this.client.closed) return
    this.client.notify('shutdown')

    const pdir = this.platformDir || path.resolve(os.cwd(), '..', 'pear')
    const fd = await new Promise((resolve, reject) => fs.open(path.join(pdir, 'corestores', 'platform', 'primary-key'), 'r+', (err, fd) => {
      if (err) {
        reject(err)
        return
      }
      resolve(fd)
    }))

    await fsext.waitForLock(fd)

    await new Promise((resolve, reject) => fs.close(fd, (err) => {
      if (err) {
        reject(err)
        return
      }
      resolve()
    }))
  }

  stage (params, opts) { return this.#notify('stage', params, opts) }

  release (params, opts) { return this.#notify('release', params, opts) }

  seed (params, opts) { return this.#notify('seed', params, opts) }

  respond (channel, responder) {
    return this.client.method(channel, responder)
  }

  unrespond (channel) {
    return this.client.method(channel, null)
  }

  request (params) {
    return this.client.request(params.channel, params)
  }

  notify (params) {
    return this.client.notify('request', params)
  }

  async * #notify (name, params, { close = true } = {}) {
    let tick = null
    let incoming = new Promise((resolve) => { tick = resolve })
    const payloads = []
    const responder = (payload) => {
      payloads.push(payload)
      tick()
      incoming = new Promise((resolve) => { tick = resolve })
    }

    const rcv = `${name}:${params.id}`
    this.respond(rcv, responder)
    this.client.notify(name, params)

    try {
      do {
        while (payloads.length > 0) {
          const payload = payloads.shift()
          if (payload === null) return
          yield payload.value
        }
        await incoming
      } while (true)
    } finally {
      this.unrespond(rcv)
      if (close) this.close()
    }
  }

  async pick (iter, ptn = {}) {
    for await (const output of iter) {
      if (this.logging) console.log('output', output)
      if (this.matchesPattern(output, ptn)) {
        if (this.logging) console.log('pick', output)
        return output.data
      }
    }
    return null
  }

  pickMany (iter, patterns = []) {
    const picks = {}
    const resolvers = {}

    patterns.forEach(({ tag }) => {
      picks[tag] = new Promise(resolve => {
        resolvers[tag] = resolve
      })
    })

    const matchesPattern = (output, pattern) => {
      return Object.keys(pattern).every(key => pattern[key] === output[key])
    };

    (async function match () {
      for await (const output of iter) {
        for (const ptn of patterns) {
          // NOTE: Only the first result of matching a specific tag is recorded, succeeding matches are ignored
          if (matchesPattern(output, ptn) && resolvers[ptn.tag]) {
            resolvers[ptn.tag](output.data ? output.data : true)
            delete resolvers[ptn.tag]
          }
        }

        if (Object.keys(resolvers).length === 0) break
      }

      patterns.forEach(({ tag }) => {
        if (resolvers[tag]) {
          resolvers[tag](null)
        }
      })
    })()

    return picks
  }

  async sink (iter, ptn) {
    for await (const output of iter) {
      if (this.logging && this.matchesPattern(output, ptn)) console.log('sink', output)
    }
  }

  async close () {
    await this.closeClients()
    await this.shutdown()
  }

  matchesPattern (message, pattern) {
    if (typeof pattern !== 'object' || pattern === null) return false
    for (const key in pattern) {
      if (Object.hasOwnProperty.call(pattern, key) === false) continue
      if (Object.hasOwnProperty.call(message, key) === false) return false
      const messageValue = message[key]
      const patternValue = pattern[key]
      const nested = typeof patternValue === 'object' && patternValue !== null && typeof messageValue === 'object' && messageValue !== null
      if (nested) {
        if (!this.matchesPattern(messageValue, patternValue)) return false
      } else if (messageValue !== patternValue) {
        return false
      }
    }
    return true
  }

  async sleep (ms) {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  static Mirror = class extends ReadyResource {
    constructor (teardown, { src = null, dest = null } = {}) {
      super()
      this.teardown = teardown
      this.srcDir = src
      this.destDir = dest
    }

    async _open () {
      this.srcDrive = new Localdrive(this.srcDir)
      this.destDrive = new Localdrive(this.destDir)

      const mirror = this.srcDrive.mirror(this.destDrive, {
        filter: (key) => {
          return !key.startsWith('.git')
        }
      })

      await mirror.done()
    }

    async _close () {
      await this.srcDrive.close()
      await this.destDrive.close()
    }

    get drive () {
      return this.destDrive
    }
  }

  static Provision = class extends ReadyResource {
    constructor (teardown, key, pearDir) {
      super()
      if (!key || !pearDir) throw new Error('Both key and pearDir params are required')

      this.teardown = teardown
      this.key = key
      this.pearDir = pearDir
    }

    async _open () {
      const KEY = decode(this.key)

      const storePath = path.join(this.pearDir, 'corestores', 'platform')
      await fs.promises.mkdir(storePath, { recursive: true })

      this.store = new Corestore(storePath)

      this.codebase = new Hyperdrive(this.store, KEY)
      await this.codebase.ready()

      this.platformDir = new Localdrive(this.pearDir)

      this.swarm = new Hyperswarm()
      this.swarm.on('connection', (socket) => { this.codebase.corestore.replicate(socket) })
    }

    async _close () {
      await this.swarm.clear()
      await this.swarm.destroy()

      await this.store.close()
      await this.codebase.close()
      await this.platformDir.close()
    }
  }

  static Inspector = class extends ReadyResource {
    #session = null

    constructor (key) {
      super()
      this.#session = new Session({ inspectorKey: Buffer.from(key, 'hex') })
    }

    async _open () {
      this.#session.connect()
    }

    async _close () {
      await this.evaluate('global.__PEAR_TEST__.inspector.disable()').catch(() => {})

      this.#session.disconnect()
      await this.#session.destroy()
    }

    async _awaitReply (id) {
      return new Promise((resolve, reject) => {
        const handler = ({ id: messageId, result, error }) => {
          if (messageId !== id) return

          if (error) reject(error)
          else resolve(result?.result)

          this.#session.off('message', handler)
        }

        this.#session.on('message', handler)
      })
    }

    async evaluate (expression, { awaitPromise = false, returnByValue = true } = {}) {
      const id = Math.floor(Math.random() * 10000)
      const reply = this._awaitReply(id)
      this.#session.post({ method: 'Runtime.evaluate', id, params: { expression, awaitPromise, returnByValue } })

      return reply
    }

    async awaitPromise (promiseObjectId, { returnByValue = true } = {}) {
      const id = Math.floor(Math.random() * 10000)
      const reply = this._awaitReply(id)
      this.#session.post({ method: 'Runtime.awaitPromise', id, params: { promiseObjectId, returnByValue } })

      return reply
    }
  }
}

module.exports = Helper
