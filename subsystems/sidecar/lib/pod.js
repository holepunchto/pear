'use strict'
const Hyperdrive = require('hyperdrive')
const { pathToFileURL } = require('url-file-url')
const plink = require('pear-link')
const Replicator = require('./replicator')
const noop = Function.prototype

module.exports = class Pod {
  platformVersion = null
  constructor(opts = {}) {
    const { corestore = false, swarm, drive = false, key, status = noop, truncate } = opts
    this.swarm = swarm
    this.key = key ? Buffer.from(key, 'hex') : null
    this.status = status
    this.corestore = corestore
    this.drive = drive || new Hyperdrive(this.corestore, this.key)
    this.link = null
    this.truncate = Number.isInteger(+truncate) ? +truncate : null

    this.replicator = new Replicator(this.drive)

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

  async close() {
    this.closed = true
    await this.leave()
    await this.drive.close()
  }
}
