'use strict'
const Hyperdrive = require('hyperdrive')
const { pathToFileURL } = require('url-file-url')
const plink = require('pear-link')
const hypercoreid = require('hypercore-id-encoding')
const Replicator = require('./replicator')
const noop = Function.prototype

module.exports = class Pod {
  platformVersion = null
  constructor(opts = {}) {
    const {
      corestore = false,
      swarm,
      drive = false,
      checkout,
      current,
      key,
      stage = false,
      status = noop,
      truncate
    } = opts
    this.swarm = swarm
    this.checkout = checkout ?? 'release'
    this.key = key ? Buffer.from(key, 'hex') : null
    this.status = status
    this.corestore = corestore
    this.stage = stage
    this.drive = drive || new Hyperdrive(this.corestore, this.key)
    this.current = current ?? this.drive?.core?.length ?? 0
    this.link = null
    this.truncate = Number.isInteger(+truncate) ? +truncate : null

    this.replicator = new Replicator(this.drive)
    this.replicator.on('announce', () => this.status({ tag: 'announced' }))
    this.drive.core.on('peer-add', (peer) => {
      this.status({
        tag: 'peer-add',
        data: peer.remotePublicKey.toString('hex')
      })
    })
    this.drive.core.on('peer-remove', (peer) => {
      this.status({
        tag: 'peer-remove',
        data: peer.remotePublicKey.toString('hex')
      })
    })

    this.batch = null
    this.queue = []
    this.closed = false

    this.announcing = null
    this.leaving = null

    this.initializing = this.#init()
  }

  async #init() {
    await this.drive.ready()
    if (Number.isInteger(this.truncate)) {
      await this.drive.truncate(this.truncate)
    }

    this.link = this.drive.key
      ? plink.serialize(this.drive.key)
      : pathToFileURL(this.drive.root).href
  }

  get db() {
    return this.drive.db
  }

  async fatal(err) {
    try {
      this.status({ tag: 'bundle-error', data: err })
      LOG.error('internal', 'Drive Bundle Failure', err)
      throw err
    } finally {
      await this.close()
    }
  }

  async ready() {
    await this.initializing
  }

  async flush() {
    if (!this.batch) return
    await this.batch.flush()
    this.batch = null
  }

  async drain() {
    await this.flush()
    const queue = this.queue.splice(-this.queue.length)
    if (queue.length === 0) return
    await Promise.allSettled(queue)
    await this.drain()
  }

  // does not throw, must never throw:
  join({ server = false, client = true } = {}) {
    if (!this.swarm) return
    if (this.announcing) return this.announcing
    if (this.replicator === null) return
    this.announcing = this.replicator.join(this.swarm, { server, client })
    this.announcing.then(() => {
      this.leaving = null
    })
    this.announcing.catch((err) => this.fatal(err))
    return this.announcing
  }

  // does not throw, must never throw:
  leave() {
    if (!this.swarm) return
    if (this.leaving) return this.leaving
    if (this.replicator === null) return
    this.leaving = this.replicator.leave(this.swarm)
    this.leaving.then(() => {
      this.announcing = null
    })
    this.leaving.catch((err) => this.fatal(err))
    return this.leaving
  }

  async calibrate() {
    await this.ready()

    if (this.drive.core.length === 0) {
      await this.drive.core.update()
    }

    if (this.stage === false) {
      if (this.current === 0) this.current = this.drive.core.length
      const length = Number.isInteger(+this.checkout) ? +this.checkout : this.current

      this.drive = this.drive.checkout?.(length) ?? this.drive
      await this.drive.ready()
    }

    this.ver = {
      key: hypercoreid.decode(this.drive.key),
      length: this.drive.version,
      fork: this.drive.core.fork
    }

    const { db } = this.drive
    const platformVersionNode = await db.get('platformVersion')
    this.platformVersion = platformVersionNode?.value || null

    return this.ver
  }

  async close() {
    this.closed = true
    await this.leave()
    await this.drain()
    await this.drive.close()
  }
}
