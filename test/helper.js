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
const { PLATFORM_DIR } = require('../constants')
const { pathname } = new URL(global.Pear.config.applink)
const NO_GC = global.Pear.config.args.includes('--no-tmp-gc')
const tmp = fs.realpathSync(os.tmpdir())
Error.stackTraceLimit = Infinity

Pear.teardown(async () => {
  console.log('# Teardown: Shutting Down Local Sidecar')
  const local = new Helper()
  await local.ready()
  await local.shutdown()
  console.log('# Teardown: Local Sidecar Shutdown')
})

class Rig {
  platformDir = path.join(tmp, 'rig-pear')
  artifactDir = env.CI ? path.join(tmp, 'artifact-pear') : Helper.localDir
  id = Math.floor(Math.random() * 10000)
  local = new Helper()
  tmp = tmp
  artifactShutdown = false
  setup = async ({ comment, timeout }) => {
    timeout(180000)
    comment('connecting to sidecar')
    await this.local.ready()
    comment('connected to sidecar')
    comment('staging platform...')
    const staging = this.local.stage({ channel: `test-${this.id}`, name: `test-${this.id}`, dir: this.artifactDir, dryRun: false, bare: true })
    await Helper.pick(staging, { tag: 'final' })
    comment('platform staged')
    const seeding = await this.local.seed({ channel: `test-${this.id}`, name: `test-${this.id}`, dir: this.artifactDir, key: null, cmdArgs: [] })
    const until = await Helper.pick(seeding, [{ tag: 'key' }, { tag: 'announced' }])
    this.key = await until.key
    await until.announced
    comment('platform seeding')
    comment('bootstrapping rig platform...')
    await Helper.bootstrap(this.key, this.platformDir)
    comment('rig platform bootstrapped')
    comment('connecting to rig sidecar')
    this.artifact = new Helper({ platformDir: this.platformDir })
    Pear.teardown(async () => {
      if (this.artifactShutdown) return
      console.log('# Teardown: Shutting Down Rig Sidecar [ DIRTY ]')
      const helper = this.artifact.closed ? new Helper({ platform: this.platformDir }) : this.artifact
      await helper.ready()
      await helper.shutdown()
      console.log('# Teardown: Rig Sidecar Shutdown [ DIRTY ]')
    })
    await this.artifact.ready()
  }

  cleanup = async ({ comment }) => {
    comment('shutdown rig sidecar')
    await this.artifact.shutdown()
    this.artifactShutdown = true
    comment('rig sidecar closed')
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
    const verbose = global.Pear.config.args.includes('--verbose')
    const platformDir = opts.platformDir || PLATFORM_DIR
    const runtime = path.join(platformDir, 'current', BY_ARCH)
    const args = ['--sidecar']
    if (verbose) args.push('--verbose')
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
            detached: !verbose,
            stdio: verbose ? 'inherit' : 'ignore'
          })
          sc.unref()
        }
    super({ lock, socketPath, connectTimeout, connect })
    this.verbose = verbose
  }

  // ONLY ADD STATICS, NEVER ADD PUBLIC METHODS OR PROPERTIES (see pear-ipc)
  static localDir = isWindows ? path.normalize(pathname.slice(1)) : pathname

  static async open (link, { tags = [] } = {}, opts = {}) {
    if (!link) throw new Error('Key is missing')

    const args = !opts.encryptionKey ? ['run', '-t', link] : ['run', '--encryption-key', opts.encryptionKey, '--no-ask', '-t', link]
    if (this.verbose) args.push('--verbose')

    const platformDir = opts.platformDir || PLATFORM_DIR
    const runtime = path.join(platformDir, 'current', BY_ARCH)
    const subprocess = spawn(runtime, args, { stdio: ['pipe', 'pipe', 'inherit'] })
    tags = ['inspector', ...tags].map((tag) => ({ tag }))

    const iterable = new Readable({ objectMode: true })
    const lineout = opts.lineout ? new Readable({ objectMode: true }) : null
    const onLine = (line) => {
      if (line.indexOf('teardown') > -1) {
        iterable.push({ tag: 'teardown', data: line })
        return
      }
      if (line.indexOf('"tag": "inspector"') > -1) {
        iterable.push(JSON.parse(line))
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
      iterable.push({ tag: 'exit', data: { code, signal } })
    })
    const until = await this.pick(iterable, tags)

    const data = await until.inspector
    const inspector = new Helper.Inspector(data.key)
    await inspector.ready()

    return { inspector, until, subprocess, lineout }
  }

  static async pick (iter, ptn = {}, by = 'tag') {
    if (Array.isArray(ptn)) return this.#pickify(iter, ptn, by)
    for await (const output of iter) {
      if ((ptn?.[by] !== 'error') && output[by] === 'error') throw new OperationError(output.data)
      if (this.matchesPattern(output, ptn)) return output.data
    }
    return null
  }

  static #pickify (iter, patterns = [], by) {
    const picks = {}
    const resolvers = {}

    for (const ptn of patterns) picks[ptn[by]] = new Promise((resolve) => { resolvers[ptn[by]] = resolve })

    const matchesPattern = (output, pattern) => {
      return Object.keys(pattern).every(key => pattern[key] === output[key])
    };

    (async function match () {
      for await (const output of iter) {
        if (output[by] === 'error') throw new OperationError(output.data)
        for (const ptn of patterns) {
          // NOTE: only resolves to first match, subsequent matches are ignored
          if (matchesPattern(output, ptn) && resolvers[ptn[by]]) {
            resolvers[ptn[by]](output.data ? output.data : true)
            resolvers[ptn[by]] = null
          }
        }

        if (Object.keys(resolvers).length === 0) break
      }

      for (const ptn of patterns) if (resolvers[ptn[by]]) resolvers.resolve[ptn[by]](null)
    })()

    return picks
  }

  static async sink (iter, ptn) {
    for await (const output of iter) {
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

    await updaterBootstrap(key, dir)
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
