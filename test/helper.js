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
const { Readable } = require('streamx')
const Pipe = require('bare-pipe')
const { arch, platform, isWindows } = require('which-runtime')

class Helper {
  constructor (teardown, opts = {}) {
    this.teardown = teardown
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
      stdio: (global.Bare || global.process).argv.includes('--attach-boot-io') ? 'inherit' : 'ignore',
      cwd: this.platformDir
    })
    sc.unref()
  }

  async * run ({ args, key = null, silent = false }) {
    if (key !== null) args = [...args.filter((arg) => arg !== key), 'run', `pear://${key}`]

    args = [...args, '--ua', 'pear/terminal']

    const di = args.findIndex(arg => arg.startsWith('--debug='))
    if (di > -1) args.push(args.splice(di, 1)[0])

    const iterable = new Readable({ objectMode: true })

    const child = spawn(this.runtime, args, {
      stdio: silent ? 'ignore' : ['inherit', 'pipe', 'pipe']
    })

    child.once('exit', (code, signal) => {
      iterable.push({ tag: 'exit', data: { code, signal } })
    })

    child.stdout.on('data', (data) => {
      const str = data.toString()
      if (silent === false) iterable.push({ tag: 'stdout', data })
      if (str.indexOf('READY') > -1) iterable.push({ tag: 'ready', data })
      if (str.indexOf('UPDATE') > -1) iterable.push({ tag: 'update', data })
    })
    if (silent === false) {
      child.stderr.on('data',
        (data) => {
          const str = data.toString()
          const ignore = str.indexOf('DevTools listening on ws://') > -1
          if (ignore) return
          iterable.push({ tag: 'stderr', data })
        })
    }

    yield * iterable
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
          if (matchesPattern(output, ptn)) {
            resolvers[ptn.tag](output.data ? output.data : true)
            delete resolvers[ptn.tag]
          }
        }
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
}

module.exports = Helper
