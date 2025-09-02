'use strict'
const fs = require('fs')
const { waitForLock } = require('fs-native-extensions')
const RW = require('read-write-mutexify')
const ReadyResource = require('ready-resource')
const { Readable } = require('streamx')
const safetyCatch = require('safety-catch')
const pipeline = require('streamx').pipelinePromise
const Hyperdrive = require('hyperdrive')
const DriveBundler = require('drive-bundler')
const DriveAnalyzer = require('drive-analyzer')
const { pathToFileURL } = require('url-file-url')
const watch = require('watch-drive')
const hypercoreid = require('hypercore-id-encoding')
const b4a = require('b4a')
const { SWAP } = require('pear-api/constants')
const Replicator = require('./replicator')
const releaseWatcher = require('./release-watcher')
const noop = Function.prototype

const ABI = 0

module.exports = class Bundle {
  platformVersion = null
  constructor (opts = {}) {
    const {
      corestore = false, swarm, drive = false, checkout = 'release', appling,
      key, channel, stage = false, status = noop, failure, asset,
      updateNotify, updatesDiff = false, truncate, encryptionKey = null
    } = opts
    this.swarm = swarm
    this.checkout = checkout ?? null
    this.appling = appling
    this.key = key ? Buffer.from(key, 'hex') : null
    this.hexKey = this.key ? this.key.toString('hex') : null
    this.channel = channel || null
    this.local = !this.key
    this.status = status
    this.failure = failure
    this.corestore = corestore
    this.stage = stage
    this.drive = drive || new Hyperdrive(this.corestore, this.key, { encryptionKey })
    this.initLength = this.drive.core?.length
    this.updatesDiff = updatesDiff
    this.link = null
    this.watchingUpdates = null
    this.truncate = Number.isInteger(+truncate) ? +truncate : null
    this._asset = asset
    if (this.corestore) {
      this.updater = this.stage ? null : new AppUpdater(this.drive, { asset })
      this.replicator = new Replicator(this.drive, { appling: this.appling })
      this.replicator.on('announce', () => this.status({ tag: 'announced' }))
      this.drive.core.on('peer-add', (peer) => {
        this.status({ tag: 'peer-add', data: peer.remotePublicKey.toString('hex') })
      })
      this.drive.core.on('peer-remove', (peer) => {
        this.status({ tag: 'peer-remove', data: peer.remotePublicKey.toString('hex') })
      })
    } else {
      this.updater = null
      this.replicator = null
    }

    this.release = null

    this.batch = null
    this.ranges = null
    this.queue = []
    this.closed = false

    this.progress = this.progresser()

    this.announcing = null
    this.leaving = null

    this.initializing = this.#init()

    this.updateNotify = updateNotify
  }

  async assets (manifest) {
    const assets = {}
    for (const [ns, asset] of Object.entries(manifest.pear?.assets || {})) {
      assets[ns] = await this._asset({ ns, ...asset })
    }
    return assets
  }

  async #updates () {
    const { updateNotify } = this
    if (typeof updateNotify !== 'function') return
    if (this.closed) return

    if (this.checkout < this.drive.version) {
      await updateNotify({
        key: this.hexKey,
        length: this.drive.core.length,
        fork: this.drive.core.fork
      }, {
        link: this.link,
        diff: null
      })
    }

    try {
      if (this.updatesDiff) {
        this.watchingUpdates = watch(this.drive)
        for await (const { key, length, fork, diff } of this.watchingUpdates) {
          if (this.updater !== null) await this.updater.wait({ length, fork })
          await updateNotify({ key, length, fork }, { link: this.link, diff })
        }
      } else {
        this.watchingUpdates = releaseWatcher(this.drive.version || 0, this.drive)
        for await (const upd of this.watchingUpdates) {
          if (this.updater !== null) await this.updater.wait({ length: upd.length, fork: upd.fork })
          await updateNotify(
            { key: this.hexKey, length: upd.length, fork: upd.fork },
            { link: this.link, diff: null }
          )
        }
      }
    } catch (err) {
      if (this.closed) return
      throw err
    } finally {
      this.watchingUpdates = null
    }
  }

  async #init () {
    await this.drive.ready()
    if (Number.isInteger(this.truncate)) {
      await this.drive.truncate(this.truncate)
    }

    this.link = this.drive.key ? 'pear://' + this.drive.core.id : pathToFileURL(this.drive.root).href

    if (this.channel && this.drive.db.feed.writable) {
      const existing = await this.drive.db.get('channel')
      if (!existing || existing.value !== this.channel) {
        await this.drive.db.put('channel', this.channel)
      }
    }
  }

  get version () {
    return this.drive.version
  }

  get db () {
    return this.drive.db
  }

  get discoveryKey () {
    return this.drive.discoveryKey
  }

  get opened () {
    return this.drive.opened
  }

  async fatal (err) {
    try {
      this.status({ tag: 'bundle-error', data: err })
      LOG.error('internal', 'Drive Bundle Failure', err)
      if (typeof this.failure === 'function') {
        await this.failure(err)
      } else {
        throw err
      }
    } finally {
      await this.close()
    }
  }

  async ready () {
    await this.initializing
  }

  entry (key) {
    return this.drive.entry(key)
  }

  compare (...args) {
    return this.drive.compare(...args)
  }

  async get (key) {
    return this.drive.get(key)
  }

  async exists (key) {
    return this.drive.exists(key)
  }

  async del (key) {
    return await this.drive.del(key)
  }

  streamFrom (meta) {
    const stream = this.drive.createReadStream(meta)
    return stream
  }

  async flush () {
    if (!this.batch) return
    await this.batch.flush()
    this.batch = null
  }

  async drain () {
    await this.flush()
    const queue = this.queue.splice(-this.queue.length)
    if (queue.length === 0) return
    await Promise.allSettled(queue)
    await this.drain()
  }

  get live () {
    return !!(this.checkout === 'release' && this.release)
  }

  async bundle (entrypoint) {
    if (!this.opened) await this.ready()
    const id = this.drive.id || 'dev'

    // TODO: gc the old assets on bundle close and on platform boot
    const assets = this.drive.core
      ? `assets/${this.drive.core.fork}.${this.drive.core.length}.${this.drive.discoveryKey.toString('hex')}`
      : true // assets on localdrives are just passthrough per default

    const res = await DriveBundler.bundle(this.drive, {
      entrypoint: entrypoint || '.',
      cwd: SWAP,
      assets,
      absoluteFiles: true,
      mount: 'pear://' + id
    })

    return { key: id, ...res }
  }

  absorbReadStream (key, readStream, metadata) {
    this.batch = this.batch || this.drive.batch()
    const inner = async () => {
      try {
        const writeStream = this.drive.createWriteStream(key, { metadata })
        await pipeline(readStream, writeStream)
      } finally {
        this.queue.splice(this.queue.findIndex((p) => p === promise), 1)
      }
    }
    const promise = inner()
    this.queue.push(promise)
    return promise
  }

  // does not throw, must never throw:
  async join ({ server = false, client = true } = {}) {
    if (!this.swarm) return
    if (this.announcing) return this.announcing
    this.announcing = this.replicator.join(this.swarm, { server, client })
    this.announcing.then(() => { this.leaving = null })
    this.announcing.catch(err => this.fatal(err))
    return this.announcing
  }

  // does not throw, must never throw:
  async leave () {
    if (!this.swarm) return
    if (this.leaving) return this.leaving
    this.leaving = this.replicator.leave(this.swarm)
    this.leaving.then(() => { this.announcing = null })
    this.leaving.catch(err => this.fatal(err))
    return this.leaving
  }

  async calibrate () {
    await this.ready()

    if (this.drive.core.length === 0) {
      await this.drive.core.update()
    }
    if (this.stage === false) {
      if (this.checkout === 'release') {
        this.release = (await this.db.get('release'))?.value
        this.#updates().catch((err) => this.fatal(err))
        if (this.release) {
          this.drive = this.drive.checkout(this.release)
        } else {
          this.drive = this.initLength > 0
            ? this.drive.checkout(this.initLength)
            : this.drive.checkout(this.drive.core.length)
        }
      } else if (this.checkout !== null && Number.isInteger(+this.checkout)) {
        this.drive = this.drive.checkout(+this.checkout)
      } else {
        this.drive = this.initLength > 0
          ? this.drive.checkout(this.initLength)
          : this.drive.checkout(this.drive.core.length)
      }
    }

    const { db } = this.drive
    const [platformVersionNode, channelNode, warmupNode] = await Promise.all([
      db.get('platformVersion'),
      db.get('channel'),
      db.get('warmup')
    ])
    this.platformVersion = (platformVersionNode?.value) || null

    if (this.channel === null) this.channel = channelNode?.value || ''

    const warmup = warmupNode?.value

    if (warmup) {
      const ranges = DriveAnalyzer.decode(warmup.meta, warmup.data)
      this.prefetch(ranges)
    }

    return { key: hypercoreid.decode(this.drive.key), length: this.drive.core.length, fork: this.drive.core.fork }
  }

  async * progresser () {
    if (this.local) {
      // no need for critical path, bail
      yield 100
      return
    }

    if (this.ranges) {
      await this.prefetch(this.ranges)
    }

    // TODO calculate percentage (need hypercore api updates to be able to do this)

    yield 100
  }

  async prefetch ({ meta = { start: 0, end: -1 }, data = { start: 0, end: -1 } } = {}) {
    if (Array.isArray(meta) === false) meta = [meta]
    if (Array.isArray(data) === false) data = [data]
    await this.drive.downloadRange(meta, data)
  }

  async close () {
    this.closed = true
    if (this.watchingUpdates) this.watchingUpdates.destroy()
    await this.leave()
    await this.drain()
    await this.drive.close()
  }
}

class AppUpdater extends ReadyResource {
  static Watcher = class Watcher extends Readable {
    constructor (updater, opts) {
      super(opts)
      this.updater = updater
      this.updater._watchers.add(this)
    }

    _destroy (cb) {
      this.updater._watchers.delete(this)
      cb(null)
    }
  }

  constructor (drive, {
    abi = ABI,
    lock = null,
    checkout = null,
    asset = noop,
    corestore = null,
    onupdating = noop,
    onupdate = noop
  } = {}) {
    super()

    this.corestore = corestore
    this.drive = drive
    this.checkout = checkout
    this.onupdate = onupdate
    this.onupdating = onupdating

    this.lock = lock
    this.abi = abi

    this.snapshot = null
    this.updated = false
    this.updating = false
    this.frozen = false

    this._asset = asset
    this._mutex = new RW()
    this._running = null
    this._lockFd = 0
    this._shouldUpdateSwap = false
    this._entrypoint = null
    this._watchers = new Set()
    this._bumpBound = this._bump.bind(this)

    this.drive.core.on('append', this._bumpBound)
    this.drive.core.on('truncate', this._bumpBound)

    this.ready().catch(safetyCatch)
  }

  async wait ({ length, fork }, opts) {
    if (fork < this.checkout.fork || (fork === this.checkout.fork && length <= this.checkout.length)) return this.checkout
    for await (const checkout of this.watch(opts)) {
      if (fork < checkout.fork || (fork === checkout.fork && length <= checkout.length)) return checkout
    }

    return null
  }

  watch (opts) {
    return new this.constructor.Watcher(this, opts)
  }

  async update () {
    if (this.opened === false) await this.ready()
    if (this.closing) throw new Error('Updater closing')

    // if updating is set, but nothing is running we need to wait a tick
    // this can only happen if the onupgrading hook/event calls update recursively, so just for extra safety
    while (this.updating && !this._running) await Promise.resolve()

    if (this._running) await this._running
    if (this._running) return this._running // debounce

    if (this.drive.core.length === this.checkout.length && this.drive.core.fork === this.checkout.fork) {
      return this.checkout
    }

    if (this.frozen) return this.checkout

    try {
      this.updating = true
      this._running = this._update()
      await this._running
    } finally {
      this._running = null
      this.updating = false
    }

    return this.checkout
  }

  _bump () {
    this.update().catch(safetyCatch)
  }

  async _ensureValidCheckout (checkout) {
    const conf = await this._getUpdatesConfig()
    if (conf.abi <= this.abi) return

    let compat = null

    for (const next of conf.compat) {
      if (next.abi > this.abi) break
      compat = next
    }

    if (compat === null) {
      throw new Error('No valid update exist')
    }

    if (compat.length < this.checkout.length) {
      throw new Error('Refusing to go back in time')
    }

    this.frozen = true
    checkout.length = compat.length
    await this.snapshot.close()
    this.snapshot = this.drive.checkout(checkout.length)
  }

  async _update () {
    const old = this.checkout
    const checkout = {
      key: this.drive.core.id,
      length: this.drive.core.length,
      fork: this.drive.core.fork
    }

    this.snapshot = this.drive.checkout(checkout.length)

    try {
      await this._ensureValidCheckout(checkout)

      await this.onupdating(checkout, old)
      this.emit('updating', checkout, old)
      await this.assets()
      await this.snapshot.download()
    } finally {
      await this.snapshot.close()
      this.snapshot = null
    }

    this.checkout = checkout
    this.updated = true

    await this.onupdate(checkout, old)
    this.emit('update', checkout, old)

    for (const w of this._watchers) w.push(checkout)
  }

  async _getUpdatesConfig () {
    const pkg = await this.snapshot.db.get('manifest')
    const updater = [].concat(pkg?.pear?.updates || [])
    const key = this.snapshot.core.key

    for (const u of updater) {
      const k = hypercoreid.decode(u.key)
      if (!b4a.equals(k, key)) continue
      return { key: k, abi: u.abi || this.abi, compat: (u.compat || []).sort(sortABI) }
    }

    return { key, abi: this.abi, compat: [] }
  }

  async assets () {
    const pkg = await this.snapshot.db.get('manifest')
    for (const [ns, asset] of Object.entries(pkg?.pear?.assets || {})) await this._asset({ ns, ...asset })
  }

  async _getLock () {
    if (this.lock === null) return 0

    const fd = await new Promise((resolve, reject) => {
      fs.open(this.lock, 'w+', function (err, fd) {
        if (err) return reject(err)
        resolve(fd)
      })
    })

    await waitForLock(fd)

    return fd
  }

  async applyUpdate () {
    await this._mutex.write.lock()
    let lock = 0

    try {
      if (!this.updated) return null

      lock = await this._getLock()

      await this.assets()

      this.emit('update-applied', this.checkout)

      return this.checkout
    } finally {
      if (lock) await closeFd(lock)
      this._mutex.write.unlock()
    }
  }

  async _open () {
    await this.drive.ready()

    if (this.checkout === null) {
      this.checkout = {
        key: this.drive.core.id,
        length: this.drive.core.length,
        fork: this.drive.core.fork
      }
    }

    this._bump() // bg
  }

  async _close () {
    if (this.snapshot) await this.snapshot.close()

    this.drive.core.removeListener('append', this._bumpBound)
    this.drive.core.removeListener('truncate', this._bumpBound)

    for (const w of this._watchers) w.push(null)
    this._watchers.clear()
  }
}

function sortABI (a, b) {
  if (a.abi === b.abi) return a.length - b.length
  return a.abi - b.abi
}

function closeFd (fd) {
  return new Promise((resolve) => {
    fs.close(fd, () => resolve())
  })
}
