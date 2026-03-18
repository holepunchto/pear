'use strict'
if (!global.Pear) {
  const path = require('bare-path')
  const checkout = require('../checkout')
  global.Pear = { constructor: { RTI: { checkout, mount: path.dirname(__dirname) } }, config: {} }
}
const os = require('bare-os')
const env = require('bare-env')
const path = require('bare-path')
const { spawn } = require('bare-subprocess')
const { spawn: daemon } = require('bare-daemon')
const fs = require('bare-fs')
const { arch, platform, isWindows } = require('which-runtime')
const IPC = require('pear-ipc')
const sodium = require('sodium-native')
const updaterBootstrap = require('pear-updater-bootstrap')
const b4a = require('b4a')
const HOST = platform + '-' + arch
const BY_ARCH = path.join('by-arch', HOST, 'bin', `pear-runtime${isWindows ? '.exe' : ''}`)
const constants = require('pear-constants')
const { PLATFORM_DIR } = constants
const NO_GC = Bare.argv.includes('--no-tmp-gc')
const MAX_OP_STEP_WAIT = env.CI ? 360000 : 120000
const tmp = fs.realpathSync(os.tmpdir())
Error.stackTraceLimit = Infinity

const rigPear = path.join(tmp, 'rig-pear')

const DHT_BOOTSTRAP = env.PEAR_TEST_BOOTSTRAP
  ? env.PEAR_TEST_BOOTSTRAP.split(',').map((addr) => {
      const [host, port] = addr.split(':')
      return { host, port: +port }
    })
  : []

class OperationError extends Error {
  constructor({ code, message, stack }) {
    super(message)
    this.code = code
    this.sidecarStack = stack
  }
}

class Helper extends IPC.Client {
  static fixture(name) {
    return path.join(Helper.localDir, 'test', 'fixtures', name)
  }
  static tmp = tmp
  static PLATFORM_DIR = PLATFORM_DIR
  static dhtBootstrap = DHT_BOOTSTRAP
  // DO NOT UNDER ANY CIRCUMSTANCES ADD PUBLIC METHODS OR PROPERTIES TO HELPER (see pear-ipc)
  constructor(opts = {}) {
    const logging = Bare.argv.slice(2).filter((arg) => arg.startsWith('--log'))
    const log = logging.length > 0
    const platformDir = opts.platformDir || PLATFORM_DIR
    const runtime = path.join(platformDir, 'current', BY_ARCH)
    const dhtBootstrap = DHT_BOOTSTRAP.map((e) => `${e.host}:${e.port}`).join(',')
    const args = ['--sidecar', '--dht-bootstrap', dhtBootstrap, ...logging]
    const pipeId = (s) => {
      const buf = b4a.allocUnsafe(32)
      sodium.crypto_generichash(buf, b4a.from(s))
      return b4a.toString(buf, 'hex')
    }
    const lock = path.join(platformDir, 'pear.lock')
    const socketPath = isWindows
      ? `\\\\.\\pipe\\pear-${pipeId(platformDir)}`
      : `${platformDir}/pear.sock`
    const connectTimeout = 20_000
    const connect = opts.expectSidecar
      ? true
      : () => {
          if (log) spawn(runtime, args, { stdio: 'inherit' })
          else daemon(runtime, args)
        }
    super({ lock, socketPath, connectTimeout, connect })
    this.log = log
    this.runtime = runtime
  }

  static getRandomId() {
    const buf = Buffer.alloc(32)
    sodium.randombytes_buf(buf)
    return buf.toString('hex')
  }

  static async touchLink(helper) {
    const touching = await helper.touch()
    const until = await Helper.pick(touching, [{ tag: 'final' }])
    const { link } = await until.final
    return link
  }

  static async teardownStream(stream) {
    if (stream.destroyed) return
    stream.end()
    return new Promise((resolve) => stream.on('close', resolve))
  }

  // ONLY ADD STATICS, NEVER ADD PUBLIC METHODS OR PROPERTIES (see pear-ipc)
  static localDir = path.dirname(__dirname)

  static async pick(stream, ptn = {}, by = 'tag') {
    if (Array.isArray(ptn)) return this.#untils(stream, ptn, by)
    for await (const output of stream) {
      if (ptn?.[by] !== 'error' && output[by] === 'error') throw new OperationError(output.data)
      if (this.matchesPattern(output, ptn)) return output.data
    }
    return null
  }

  static #untils(stream, patterns = [], by) {
    const untils = {}
    for (const ptn of patterns) {
      untils[ptn[by]] = new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(
            new Error(
              'Helper: Data Timeout for ' +
                JSON.stringify(ptn) +
                ' after ' +
                MAX_OP_STEP_WAIT +
                'ms'
            )
          )
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

  static async sink(stream) {
    for await (const output of stream) {
      if (output.tag === 'error') throw new Error(output.data?.stack)
    }
  }

  static matchesPattern(message, pattern) {
    if (typeof pattern !== 'object' || pattern === null) return false
    for (const key in pattern) {
      if (Object.hasOwnProperty.call(pattern, key) === false) continue
      if (Object.hasOwnProperty.call(message, key) === false) return false
      const messageValue = message[key]
      const patternValue = pattern[key]
      const nested =
        typeof patternValue === 'object' &&
        patternValue !== null &&
        typeof messageValue === 'object' &&
        messageValue !== null
      if (nested) {
        if (!this.matchesPattern(messageValue, patternValue)) return false
      } else if (messageValue !== patternValue) {
        return false
      }
    }
    return true
  }

  static async bootstrap(key, dir) {
    await Helper.gc(dir)
    await fs.promises.mkdir(dir, { recursive: true })
    await updaterBootstrap(key, dir, { bootstrap: DHT_BOOTSTRAP })
  }

  static async gc(dir) {
    if (NO_GC) return
    await fs.promises.rm(dir, { recursive: true }).catch(() => {})
  }
}

class Rig {
  platformDir = rigPear
  artefactDir = Helper.localDir
  local = new Helper()
  tmp = tmp
  keepAlive = true
  constructor({ keepAlive = true } = {}) {
    this.keepAlive = keepAlive
  }

  setup = async ({ comment, timeout }) => {
    timeout(180000)
    comment('connecting to sidecar')
    await this.local.ready()
    comment('connected to sidecar')

    this.link = await Helper.touchLink(this.local)

    comment('staging platform...')
    const staging = this.local.stage({
      link: this.link,
      dir: this.artefactDir,
      dryRun: false
    })
    await Helper.pick(staging, { tag: 'final' })
    comment('platform staged')

    comment('seeding platform')
    this.seeder = new Helper()
    await this.seeder.ready()
    this.seeding = this.seeder.seed({
      link: this.link,
      dir: this.artefactDir,
      key: null,
      cmdArgs: []
    })
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

Helper.Rig = Rig

module.exports = Helper

class Reiterate {
  constructor(stream) {
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

  _ondata(value) {
    this.buffer.push({ value, done: false })
    for (const { resolve } of this.readers) resolve()
    this.readers.length = 0
  }

  _onend() {
    this.buffer.push({ done: true })
    this.complete = true
    for (const { resolve } of this.readers) resolve()
    this.readers.length = 0
  }

  _onerror(err) {
    for (const { reject } of this.readers) reject(err)
    this.readers.length = 0
  }

  async *_tail() {
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

  [Symbol.asyncIterator]() {
    return this._tail()
  }
}
