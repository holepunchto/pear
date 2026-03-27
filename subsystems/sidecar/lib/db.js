'use strict'
const DBLock = require('db-lock')

class Lock extends DBLock {
  #manual = false
  #tx = null
  constructor(db) {
    super({
      enter: () => {
        this.#tx = db.transaction()
        return this.#tx
      },
      exit: (tx) => tx.flush(),
      maxParallel: 1
    })
  }

  enter() {
    if (this.#manual && this.#tx !== null) return this.#tx
    return super.enter()
  }

  exit() {
    if (this.#manual) return Promise.resolve()
    return super.exit()
  }

  manual() {
    this.#manual = true
    return async () => {
      try {
        await super.exit()
      } finally {
        this.#manual = false
      }
    }
  }
}

class Model {
  constructor(hyperdb) {
    this.hyperdb = hyperdb
    this.lock = new Lock(this.hyperdb)
  }

  async ready() {
    LOG.trace('db', 'READY')
    await this.hyperdb.ready()
  }

  async getDhtNodes() {
    LOG.trace('db', 'GET', '@pear/dht', '[nodes]')
    return (await this.hyperdb.get('@pear/dht'))?.nodes || []
  }

  async setDhtNodes(nodes) {
    const tx = await this.lock.enter()
    const insert = { nodes }
    LOG.trace('db', 'INSERT', '@pear/dht', insert)
    await tx.insert('@pear/dht', insert)
    await this.lock.exit()
  }

  async getMultisig(key) {
    const get = { key }
    LOG.trace('db', 'GET', '@pear/multisig', get)
    return await this.hyperdb.get('@pear/multisig', get)
  }

  async allMultisig() {
    LOG.trace('db', 'FIND', '@pear/multisig')
    return await this.hyperdb.find('@pear/multisig').toArray()
  }

  async setMultisig(key) {
    const tx = await this.lock.enter()
    const insert = { key }
    LOG.trace('db', 'INSERT', '@pear/multisig', insert)
    await tx.insert('@pear/multisig', insert)
    await this.lock.exit()
    return insert
  }

  async close() {
    LOG.trace('db', 'CLOSE')
    await this.hyperdb.close()
  }
}

exports.spec = require('../../../spec/db')
exports.Model = Model
