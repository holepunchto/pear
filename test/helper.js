/* global Pear */
'use strict'
const os = require('bare-os')
const env = require('bare-env')
const path = require('bare-path')
const { spawn } = require('bare-subprocess')
const fs = require('bare-fs')
const ReadyResource = require('ready-resource')
const { arch, platform, isWindows } = require('which-runtime')
const { Session } = require('pear-inspect')
const { Readable } = require('streamx')
const NewlineDecoder = require('newline-decoder')
const IPC = require('pear-ipc')
const sodium = require('sodium-native')
const updaterBootstrap = require('pear-updater-bootstrap')
const b4a = require('b4a')
const HOST = platform + '-' + arch
const BY_ARCH = path.join('by-arch', HOST, 'bin', `pear-runtime${isWindows ? '.exe' : ''}`)
const constants = require('../constants')
const { PLATFORM_DIR, RUNTIME } = constants
const { pathname } = new URL(global.Pear.config.applink)
const NO_GC = global.Pear.config.args.includes('--no-tmp-gc')
const MAX_OP_STEP_WAIT = env.CI ? 360000 : 120000
const tmp = fs.realpathSync(os.tmpdir())
Error.stackTraceLimit = Infinity
const program = global.Bare || global.process

const rigPear = path.join(tmp, 'rig-pear')

Pear.teardown(async () => {
  console.log('# Teardown: Shutting Down Local Sidecar')
  const local = new Helper()
  console.log('# Teardown: Connecting Local Sidecar')
  await local.ready()
  console.log('# Teardown: Triggering Shutdown of Local Sidecar')
  await local.shutdown()
  console.log('# Teardown: Local Sidecar Shutdown')
})

class Rig {
  platformDir = rigPear
  artefactDir = Helper.localDir
  id = Math.floor(Math.random() * 10000)
  local = new Helper()
  tmp = tmp
  keepAlive = true
  constructor ({ keepAlive = true } = {}) {
    this.keepAlive = keepAlive
  }

  setup = async ({ comment, timeout }) => {
    timeout(180000)
    comment('connecting to sidecar')
    await this.local.ready()
    comment('connected to sidecar')

    comment('staging platform...')
    const staging = this.local.stage({ channel: `test-${this.id}`, name: `test-${this.id}`, dir: this.artefactDir, dryRun: false, bare: true })
    await Helper.pick(staging, { tag: 'final' })
    comment('platform staged')

    comment('seeding platform')
    this.seeder = new Helper()
    await this.seeder.ready()
    this.seeding = this.seeder.seed({ channel: `test-${this.id}`, name: `test-${this.id}`, dir: this.artefactDir, key: null, cmdArgs: [] })
    const until = await Helper.pick(this.seeding, [{ tag: 'key' }, { tag: 'announced' }])
    this.key = await until.key
    await until.announced
    comment('platform seeding')

    comment('bootstrapping rig platform...')
    await Helper.bootstrap(this.key, this.platformDir)
    comment('rig platform bootstrapped')
    if (this.keepAlive) {
      comment('connecting to rig sidecar')
      this.rig = new Helper(this)
      await this.rig.ready()
      comment('connected to rig sidecar')
    }
  }

  cleanup = async ({ comment }) => {
    comment('closing seeder client')
    await Helper.teardownStream(this.seeding)
    await this.seeder.close()
    comment('seeder client closed')
    if (this.keepAlive) {
      comment('shutting down rig sidecar')
      await this.rig.shutdown()
      comment('rig sidecar shutdown')
    }
    comment('closing local client')
    await this.local.close()
    comment('local client closed')
  }
}

class OperationError extends Error {
  constructor ({ code, message, stack }) {
    super(message)
    this.code = code
    this.sidecarStack = stack
  }
}

class Helper extends IPC {
  static Rig = Rig
  static tmp = tmp
  static PLATFORM_DIR = PLATFORM_DIR
  // DO NOT UNDER ANY CIRCUMSTANCES ADD PUBLIC METHODS OR PROPERTIES TO HELPER (see pear-ipc)
  constructor (opts = {}) {
    const log = global.Pear.config.args.includes('--log')
    const platformDir = opts.platformDir || PLATFORM_DIR
    const runtime = path.join(platformDir, 'current', BY_ARCH)
    const dhtBootstrap = Pear.config.dht.bootstrap.map(e => `${e.host}:${e.port}`).join(',')
    const args = ['--sidecar', '--dht-bootstrap', dhtBootstrap]
    if (log) args.push('--log')
    const pipeId = (s) => {
      const buf = b4a.allocUnsafe(32)
      sodium.crypto_generichash(buf, b4a.from(s))
      return b4a.toString(buf, 'hex')
    }
    const lock = path.join(platformDir, 'corestores', 'platform', 'primary-key')
    const socketPath = isWindows ? `\\\\.\\pipe\\pear-${pipeId(platformDir)}` : `${platformDir}/pear.sock`
    const connectTimeout = 20_000
    const connect = opts.expectSidecar
      ? true
      : () => {
          const sc = spawn(runtime, args, {
            detached: !log,
            stdio: log ? 'inherit' : 'ignore'
          })
          sc.unref()
        }
    super({ lock, socketPath, connectTimeout, connect })
    this.log = log
  }

  static async teardownStream (stream) {
    if (stream.destroyed) return
    stream.end()
    return new Promise((resolve) => stream.on('close', resolve))
  }

  // ONLY ADD STATICS, NEVER ADD PUBLIC METHODS OR PROPERTIES (see pear-ipc)
  static localDir = isWindows ? path.normalize(pathname.slice(1)) : pathname

  static async run ({ link, encryptionKey, platformDir }) {
    if (encryptionKey) program.argv.splice(2, 0, '--encryption-key', encryptionKey)
    if (platformDir) Pear.worker.constructor.RUNTIME = path.join(platformDir, 'current', BY_ARCH)

    const pipe = Pear.worker.run(link)

    if (platformDir) Pear.worker.constructor.RUNTIME = RUNTIME
    if (encryptionKey) program.argv.splice(2, 2)

    return { pipe }
  }

  static async untilResult (pipe, timeout = 1000) {
    const res = new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => reject(new Error('timed out')), timeout)
      pipe.on('data', (data) => {
        clearTimeout(timeoutId)
        resolve(data.toString())
      })
      pipe.on('close', () => {
        clearTimeout(timeoutId)
        reject(new Error('unexpected closed'))
      })
      pipe.on('end', () => {
        clearTimeout(timeoutId)
        reject(new Error('unexpected ended'))
      })
    })
    pipe.write('start')
    return res
  }

  static async untilClose (pipe, timeout = 1000) {
    const res = new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => reject(new Error('timed out')), timeout)
      pipe.on('close', () => {
        clearTimeout(timeoutId)
        resolve('closed')
      })
      pipe.on('end', () => {
        clearTimeout(timeoutId)
        resolve('ended')
      })
    })
    pipe.end()
    return res
  }

  static async open (link, { tags = [] } = {}, opts = {}) {
    if (!link) throw new Error('Key is missing')

    const dhtBootstrap = Pear.config.dht.bootstrap.map(e => `${e.host}:${e.port}`).join(',')
    const args = !opts.encryptionKey ? ['run', '--dht-bootstrap', dhtBootstrap, '-t', link] : ['run', '--dht-bootstrap', dhtBootstrap, '--encryption-key', opts.encryptionKey, '--no-ask', '-t', link]
    if (this.log) args.push('--log')

    const platformDir = opts.platformDir || PLATFORM_DIR
    const runtime = path.join(platformDir, 'current', BY_ARCH)
    const subprocess = spawn(runtime, args, { stdio: ['pipe', 'pipe', 'inherit'] })
    tags = ['inspector', ...tags].map((tag) => ({ tag }))

    const stream = new Readable({ objectMode: true })
    const lineout = opts.lineout ? new Readable({ objectMode: true }) : null
    const onLine = (line) => {
      if (line.indexOf('teardown') > -1) {
        stream.push({ tag: 'teardown', data: line })
        return
      }
      if (line.indexOf('"tag": "inspector"') > -1) {
        stream.push(JSON.parse(line))
        return
      }
      if (opts.lineout) lineout.push(line)
      else console.log('# unexpected', line)
    }
    const decoder = new NewlineDecoder()
    subprocess.stdout.on('data', (data) => {
      for (const line of decoder.push(data)) onLine(line.toString().trim())
    })
    subprocess.once('exit', (code, signal) => {
      for (const line of decoder.end()) onLine(line.toString().trim())
      stream.push({ tag: 'exit', data: { code, signal } })
    })
    const until = await this.pick(stream, tags)

    const data = await until.inspector
    const inspector = new Helper.Inspector(data.key)
    await inspector.ready()

    return { inspector, until, subprocess, lineout }
  }

  static async pick (stream, ptn = {}, by = 'tag') {
    if (Array.isArray(ptn)) return this.#untils(stream, ptn, by)
    for await (const output of stream) {
      if ((ptn?.[by] !== 'error') && output[by] === 'error') throw new OperationError(output.data)
      if (this.matchesPattern(output, ptn)) return output.data
    }
    return null
  }

  static #untils (stream, patterns = [], by) {
    const untils = {}
    for (const ptn of patterns) {
      untils[ptn[by]] = new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Helper: Data Timeout for ' + JSON.stringify(ptn) + ' after ' + MAX_OP_STEP_WAIT + 'ms'))
        }, MAX_OP_STEP_WAIT)
        const onclose = () => reject(new Error('Helper: Unexpected close on stream'))
        const onerror = (err) => reject(err)
        const ondata = (data) => {
          if (data === null || data?.tag === 'final') stream.off('close', onclose)
        }
        stream.on('data', ondata)
        stream.on('close', onclose)
        stream.on('error', onerror)
        const onpick = (data) => {
          const result = data === undefined ? true : data
          resolve(result)
        }
        this.pick(new Reiterate(stream), ptn, by)
          .then(onpick, reject)
          .finally(() => {
            clearTimeout(timeout)
            stream.off('data', ondata)
            stream.off('close', onclose)
            stream.off('error', onerror)
          })
      })
    }
    return untils
  }

  static async sink (stream, ptn) {
    for await (const output of stream) {
      if (output.tag === 'error') throw new Error(output.data?.stack)
    }
  }

  static matchesPattern (message, pattern) {
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

  static async bootstrap (key, dir) {
    await Helper.gc(dir)
    await fs.promises.mkdir(dir, { recursive: true })

    await updaterBootstrap(key, dir, { bootstrap: Pear.config.dht.bootstrap })
  }

  static async gc (dir) {
    if (NO_GC) return

    await fs.promises.rm(dir, { recursive: true }).catch(() => { })
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
      await this.evaluate('global.__PEAR_TEST__.inspector.disable()').catch(() => { })

      this.#session.disconnect()
      await this.#session.destroy()
    }

    async _unwrap () {
      return new Promise((resolve, reject) => {
        const handler = ({ result, error }) => {
          if (error) reject(error)
          else resolve(result?.result)

          this.#session.off('message', handler)
        }

        this.#session.on('message', handler)
      })
    }

    async evaluate (expression, { awaitPromise = false, returnByValue = true } = {}) {
      const reply = this._unwrap()
      this.#session.post({ method: 'Runtime.evaluate', params: { expression, awaitPromise, returnByValue } })

      return reply
    }

    async awaitPromise (promiseObjectId, { returnByValue = true } = {}) {
      const id = Math.floor(Math.random() * 10000)
      const reply = this._unwrap(id)
      this.#session.post({ method: 'Runtime.awaitPromise', params: { promiseObjectId, returnByValue } })

      return reply
    }
  }
}

module.exports = Helper

class Reiterate {
  constructor (stream) {
    this.stream = stream
    this.complete = false
    this.buffer = []
    this.readers = []

    this._ondata = this._ondata.bind(this)
    this._onend = this._onend.bind(this)
    this.onerror = this._onerror.bind(this)

    this.stream.on('data', this._ondata)
    this.stream.on('end', this._onend)
    this.stream.on('error', this._onerror)
  }

  _ondata (value) {
    this.buffer.push({ value, done: false })
    for (const { resolve } of this.readers) resolve()
    this.readers.length = 0
  }

  _onend () {
    this.buffer.push({ done: true })
    this.complete = true
    for (const { resolve } of this.readers) resolve()
    this.readers.length = 0
  }

  _onerror (err) {
    for (const { reject } of this.readers) reject(err)
    this.readers.length = 0
  }

  async * _tail () {
    try {
      let i = 0
      while (i < this.buffer.length || !this.complete) {
        if (i < this.buffer.length) {
          const { value, done } = this.buffer[i++]
          if (done) break
          yield value
        } else {
          await new Promise((resolve, reject) => this.readers.push({ resolve, reject }))
        }
      }
    } finally {
      this.stream.off('data', this._ondata)
      this.stream.off('end', this._onend)
      this.stream.off('error', this._onerror)
    }
  }

  [Symbol.asyncIterator] () { return this._tail() }
}
