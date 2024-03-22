'use strict'
const path = require('bare-path')
const { spawn } = require('bare-subprocess')
const os = require('bare-os')
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
            console.log('runtime:', RUNTIME)
            const sc = spawn(RUNTIME, ['--sidecar', '--verbose'], {
              detached: true,
              stdio: 'inherit'
            })

            sc.unref()
          }
    })
    this.#expectSidecar = opts.expectSidecar
    this.opts = opts
  }

  static logging = false

  static async open (key, { tags = [] } = {}) {
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

  static async * run ({ args, key = null, silent = false }) {
    if (key !== null) args = [...args.filter((arg) => arg !== key), 'run', `pear://${key}`]

    args = [...args, '--ua', 'pear/terminal']

    const child = spawn(RUNTIME, args, {
      stdio: silent ? 'ignore' : ['pipe', 'pipe', 'inherit']
    })

    yield { tag: 'child', data: child }
  }

  static async pick (iter, ptn = {}) {
    for await (const output of iter) {
      if (this.logging) console.log('output', output)
      if (this.matchesPattern(output, ptn)) {
        if (this.logging) console.log('pick', output)
        return output.data
      }
    }
    return null
  }

  static pickMany (iter, patterns = []) {
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
        if (output.tag === 'error') throw new Error(output.data?.stack)
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

  static async sink (iter, ptn) {
    for await (const output of iter) {
      if (this.logging && this.matchesPattern(output, ptn)) console.log('sink', output)
    }
  }

  async _close () {
    await this.closeClients()
    await this.shutdown()
    await super._close()
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
