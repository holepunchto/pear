'use strict'
const pipeline = require('streamx').pipelinePromise
const Hyperdrive = require('hyperdrive')
const DriveBundler = require('drive-bundler')
const { pathToFileURL } = require('url-file-url')
const { SWAP } = require('pear-api/constants')
const Replicator = require('./replicator')
const releaseWatcher = require('./release-watcher')
const noop = Function.prototype

module.exports = class Bundle {
  platformVersion = null
  constructor (opts = {}) {
    const {
      corestore = false, drive = false, checkout = 'release', appling,
      key, channel, stage = false, status = noop, failure,
      updateNotify, updatesDiff = false, truncate, encryptionKey = null
    } = opts
    this.checkout = checkout
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
    this.updatesDiff = updatesDiff
    this.link = null
    this.watchingUpdates = null
    this.truncate = Number.isInteger(+truncate) ? +truncate : null
    if (this.corestore) {
      this.replicator = new Replicator(this.drive, { appling: this.appling })
      this.replicator.on('announce', () => this.status({ tag: 'announced' }))
      this.drive.core.on('peer-add', (peer) => {
        this.status({ tag: 'peer-add', data: peer.remotePublicKey.toString('hex') })
      })
      this.drive.core.on('peer-remove', (peer) => {
        this.status({ tag: 'peer-remove', data: peer.remotePublicKey.toString('hex') })
      })
    } else {
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
    this.swarm = null

    this.initializing = this.#init()

    if (typeof updateNotify === 'function') this.#updates(updateNotify)
  }

  async #updates (updateNotify) {
    await this.ready()
    if (this.closed) return
    try {
      if (this.updatesDiff) {
        this.watchingUpdates = watch(this.drive)
        for await (const { key, length, fork, diff } of this.watchingUpdates) {
          updateNotify({ key, length, fork }, { link: this.link, diff })
        }
      } else {
        this.watchingUpdates = releaseWatcher(this.drive.version || 0, this.drive)
        for await (const upd of this.watchingUpdates) {
          updateNotify(
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

  async has (key) { // TODO: remove has, use exists
    const meta = await this.entry(key)
    return meta !== null
  }

  async exists (key) {
    return this.has(key) // TODO: use this.drive.exists when its on localdrive
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

  async join (swarm, { server = false, client = true } = {}) {
    if (this.announcing) return this.announcing
    this.swarm = swarm
    this.announcing = this.replicator.join(swarm, { server, client })
    this.announcing.then(() => { this.leaving = null })
    this.announcing.catch(err => this.fatal(err))
    return this.announcing
  }

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
        if (this.release) this.drive = this.drive.checkout(this.release)
      } else if (Number.isInteger(+this.checkout)) {
        this.drive = this.drive.checkout(+this.checkout)
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
