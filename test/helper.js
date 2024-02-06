'use strict'
const { createRequire } = require('module')
const Protomux = require('protomux')
const Channel = require('jsonrpc-mux')
const portget = require('port-get')
const Crank = require('../ipc/crank')
const path = require('path')
const { spawn } = require('child_process')
const Corestore = require('corestore')
const Bootdrive = require('boot-drive')
const Hyperdrive = require('hyperdrive')
const Hyperswarm = require('hyperswarm')
const Localdrive = require('localdrive')
const fs = require('fs')
const fsext = require('fs-native-extensions')
const { decode } = require('hypercore-id-encoding')
const ReadyResource = require('ready-resource')
const { Readable } = require('streamx')

// TODO: need to support  again for testnet
// TODO: support option for --swap path w/ creation of dir (OR add --tmp-swap option to codebase and just use that)
// TODO: consider smoke testing keet desktop (stage -> seed -> launch) (can we just clone from key??)

class Helper {
  constructor (teardown, opts = {}) {
    this.teardown = teardown
    this.opts = opts
    this.logging = this.opts.logging || !!process.env.TESTLOG
    this.argv = [...process.argv]
    this.client = null
    this.platformDir = this.opts.platformDir || path.resolve(__dirname, '..', 'pear')
    this.swap = this.opts.swap || path.resolve(__dirname, '..', 'pear', 'current')
    if (this.logging) this.argv.push('--attach-boot-io')
  }

  port = portget

  async bootstrap ({ forceFresh = false } = {}) {
    const { bootstrap } = require('../boot')

    const compile = (source) => {
      this.teardown(() => this.destroy(this.client))
      return (stream) => {
        this.client = new Channel(new Protomux(stream))
        return new Function('require', 'return ' + source)(createRequire(require.resolve('../boot.js')))(stream) // eslint-disable-line no-new-func
      }
    }
    const trycount = await bootstrap(compile, this.opts.ua || 'pear/noop', this.argv)
    if (forceFresh && trycount === 0) {
      throw new Error('Test helper unable to bootstrap fresh sidecar, no way to set local DHT. Ensure conflicting sidecars are closed')
    }
    return this.client
  }

  start (...args) {
    return this.client.request('start', { args })
  }

  async * run ({ args, dev, key = null, dir = null, silent = false }) {
    if (key !== null) args = [...args.filter((arg) => arg !== key), '--run', key]
    if (dev === true && args.includes('--dev') === false) args = ['--dev', ...args]

    args = [...args, '--ua', 'pear/terminal', '--debug']

    const iterable = new Readable({ objectMode: true })

    const swap = this.swap || path.resolve(__dirname, '..', 'pear', 'current')
    const runtime = this.terminalRuntime(swap)

    const child = spawn(runtime, args.map(String), {
      stdio: silent ? 'ignore' : ['inherit', 'pipe', 'pipe']
    })
    child.once('exit', (code, signal) => { iterable.push({ tag: 'exit', data: { code, signal } }) })

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
          console.log('run stderr:', str)
          const ignore = str.indexOf('DevTools listening on ws://') > -1
          if (ignore) return
          iterable.push({ tag: 'stderr', data })
        })
    }

    yield * iterable
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

    const pdir = this.platformDir || path.resolve(__dirname, '..', 'pear')
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

  info (params, opts) { return this.#notify('info', params, opts) }

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

  async apploaded (inspect) {
    await inspect.Runtime.enable()
    await inspect.Page.enable()
    const loading = inspect.Page.loadEventFired()
    const readyState = await inspect.Runtime.evaluate({ expression: 'document.readyState', returnByValue: true })
    if (readyState.result.value !== 'complete') await loading
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

  async destroy () {
    const { bootstrap } = require('../boot')
    try {
      await this.closeClients()
      await this.shutdown()
    } catch (err) {
      if (err.code !== 'E_SESSION_CLOSED') throw err
      await bootstrap((source) => {
        return (stream) => {
          this.client = new Crank(new Channel(new Protomux(stream)))
          return new Function('require', 'return ' + source)(createRequire(require.resolve('../boot.js')))(stream) // eslint-disable-line no-new-func
        }
      }, 'pear/noop')
      await this.closeClients()
      await this.shutdown()
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

  async launchFromDir ({ platformDir, dbgport }) {
    const entry = path.join(platformDir, './current/boot.js')
    const args = [entry, 'launch', 'keet', `--platform-dir=${platformDir}`, '--inspector-port', dbgport.toString()]

    spawn(process.execPath, args, {
      stdio: 'ignore',
      env: { ...process.env, NODE_PRESERVE_SYMLINKS: 1 }
    })
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

    async provision () {
      let codebase = this.codebase
      const platformDir = this.platformDir
      const swarm = this.swarm
      const key = this.key
      const pearDir = this.pearDir

      const length = null
      const fork = null

      const current = path.join(pearDir, 'current')

      const dkey = codebase.discoveryKey.toString('hex')

      let latest = '0'
      for await (const swap of platformDir.readdir(`/by-dkey/${dkey}`)) {
        if (Number.isInteger(+swap)) latest = swap
      }

      swarm.join(codebase.discoveryKey, { server: false, client: true })
      const done = codebase.corestore.findingPeers()
      swarm.flush().then(done, done)

      await codebase.core.update() // make sure we have latest version

      codebase = codebase.checkout(codebase.version)

      await codebase.ready()

      const checkout = { key, length, fork }

      if (checkout.length === null) {
        checkout.length = codebase.version
        checkout.fork = codebase.core.fork
      }

      const prefix = '/by-arch/' + process.platform + '-' + process.arch + '/'
      let completed = 0

      if (await codebase.get('/boot.js') === null) {
        throw new Error('  🚫 Couldn\'t get entrypoint /boot.js.\n     Either no such file exists or it\'s not available on the network\n')
      }

      let total = 0
      const dls = []
      for await (const entry of codebase.list('/', { recursive: true })) {
        if (!entry.value.blob) continue
        if (entry.key.startsWith('/by-arch') && entry.key.startsWith(prefix) === false) continue
        total++
      }

      for await (const entry of codebase.list('/', { recursive: true })) {
        if (!entry.value.blob) continue
        if (entry.key.startsWith('/by-arch') && entry.key.startsWith(prefix) === false) continue
        const blobs = await codebase.getBlobs()
        const r = blobs.core.download({ start: entry.value.blob.blockOffset, length: entry.value.blob.blockLength })
        const dl = r.downloaded()
        dls.push(dl)
        dl.then(() => { completed++ })
      }

      const settled = Promise.allSettled(dls)

      /* eslint-disable no-unmodified-loop-condition */
      while (completed < total) {
        await new Promise(resolve => setTimeout(resolve, 50))
      }
      /* eslint-enable no-unmodified-loop-condition */

      const result = await settled

      for (const promise of result) {
        if (promise.status === 'rejected') {
          throw new Error('A promise was rejected')
        }
      }

      const swap = path.join(pearDir, 'by-dkey', dkey, latest)

      const checkoutjs = `module.exports = {key: '${checkout.key}', fork: ${checkout.fork}, length: ${checkout.length}}`
      if (this.logging) console.log('   key: ' + checkout.key + ',     fork: ' + checkout.fork + ',     length: ' + checkout.length)

      const boot = new Bootdrive(codebase, {
        entrypoint: 'boot.js',
        cwd: swap,
        additionalBuiltins: [
          'pear', // lazily self-injected
          'module', 'events', 'path', 'os', 'timers', 'buffer', 'console', 'assert', 'tty',
          'http', 'fs', 'fs/promises', 'url', 'child_process', 'readline', 'repl', 'inspector',
          'electron', 'net', 'util', 'stream', 'dns', 'https', 'tls', 'crypto', 'zlib', 'constants', // Holepunch Runtime only
          'bare-pipe', 'bare-bundle', 'bare-hrtime', // bare
          'fsctl', 'bufferutil', 'utf-8-validate' // optional deps (ignore)
        ],
        sourceOverwrites: {
          '/checkout.js': Buffer.from(checkoutjs)
        }
      })

      await boot.warmup()

      const bootjs = boot.stringify()

      await platformDir.put(`./by-dkey/${dkey}/${latest}/boot.js`, bootjs)

      const preferences = 'preferences.json'
      if (await platformDir.entry(preferences) === null) await platformDir.put(preferences, Buffer.from('{}'))

      try { await fs.promises.unlink(current) } catch { }
      await fs.promises.symlink(swap, current, 'junction')
    }
  }

  desktopRuntime (swap) {
    switch (process.platform) {
      case ('darwin'):
        return path.join(swap, 'by-arch', process.platform + '-' + process.arch, 'bin', 'Holepunch Runtime.app', 'Contents', 'MacOS', 'Holepunch Runtime')
      case ('win32'):
        return path.join(swap, 'by-arch', process.platform + '-' + process.arch, 'bin', 'holepunch-runtime', 'Holepunch Runtime.exe')
      default:
        return path.join(swap, 'by-arch', process.platform + '-' + process.arch, 'bin', 'holepunch-runtime', 'holepunch-runtime')
    }
  }

  terminalRuntime (swap) { return path.join(swap, 'by-arch', process.platform + '-' + process.arch, 'bin', 'pear-runtime') }

  clearRequireCache () {
    const files = [
      '../boot.js',
      '../bootstrap.js',
      '../lib/constants.js'
    ]

    for (const file of files) {
      const path = require.resolve(file)
      delete require.cache[path]
    }
  }
}

module.exports = Helper
