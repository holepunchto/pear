'use strict'
const path = require('bare-path')
const { spawn } = require('bare-subprocess')
const os = require('bare-os')
const fs = require('bare-fs')
const fsext = require('fs-native-extensions')
const ReadyResource = require('ready-resource')
const { arch, platform, isWindows } = require('which-runtime')
const { Session } = require('pear-inspect')
const { Readable } = require('streamx')
const IPC = require('pear-ipc')
const RUNTIME = path.join(os.cwd(), '..', 'by-arch', platform + '-' + arch, 'bin', `pear-runtime${isWindows ? '.exe' : ''}`)

class Helper extends IPC {
  #expectSidecar = false

  constructor (opts = {}) {
    const platformDir = opts.platformDir || path.resolve(os.cwd(), '..', 'pear')
    super({
      socketPath: isWindows ? '\\\\.\\pipe\\pear' : `${platformDir}/pear.sock`,
      connectTimeout: 20_000,
      connect: opts.expectSidecar
        ? true
        : () => {
            const sc = spawn(RUNTIME, ['--sidecar', '--verbose'], {
              detached: true
            })
            sc.unref()
          }
    })
    this.#expectSidecar = opts.expectSidecar
    this.opts = opts
  }

  static logging = false

  static async open (key, { tags = [] } = {}, opts = {}) {
    if (!key) throw new Error('Key is missing')
    const args = ['run', key.startsWith('pear://') ? key : `pear://${key}`]

    const subprocess = spawn(RUNTIME, args, { stdio: ['pipe', 'pipe', 'inherit'] })
    tags = ['inspector', ...tags].map((tag) => ({ tag }))

    const iterable = new Readable({ objectMode: true })

    subprocess.once('exit', (code, signal) => {
      iterable.push({ tag: 'exit', data: { code, signal } })
    })

    subprocess.stdout.on('data', (data) => {
      data = data.toString().trim()
      if (data.indexOf('teardown') > -1) {
        iterable.push({ tag: 'teardown', data })
        return
      }
      if (data.indexOf('"tag": "inspector"') > -1) {
        iterable.push(JSON.parse(data))
        return
      }
      console.error('Unrecognized subprocess STDOUT output:', data)
    })

    const until = await this.pick(iterable, tags)

    const data = await until.inspector
    const inspector = new Helper.Inspector(data.key)
    await inspector.ready()

    return { inspector, until, subprocess }
  }

  static async pick (iter, ptn = {}, by = 'tag') {
    if (Array.isArray(ptn)) return this.#pickify(iter, ptn, by)
    for await (const output of iter) {
      if (this.logging) console.log('output', output)
      if (this.matchesPattern(output, ptn)) {
        if (this.logging) console.log('pick', output)
        return output.data
      }
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
        if (output[by] === 'error') throw new Error(output.data?.stack)
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
      if (this.logging && this.matchesPattern(output, ptn)) console.log('sink', output)
    }
  }

  async accessLock (platformDir) {
    const pdir = platformDir || path.resolve(os.cwd(), '..', 'pear')
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

  async sleep (ms) {
    return new Promise(resolve => setTimeout(resolve, ms))
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
