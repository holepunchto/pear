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
  constructor(rocks) {
    this.db = rocks
    this.lock = new Lock(this.db)
  }

  async getDhtNodes() {
    LOG.trace('db', 'GET', '@pear/dht', '[nodes]')
    return (await this.db.get('@pear/dht'))?.nodes || []
  }

  async setDhtNodes(nodes) {
    const tx = await this.lock.enter()
    const insert = { nodes }
    LOG.trace('db', 'INSERT', '@pear/dht', insert)
    await tx.insert('@pear/dht', insert)
    await this.lock.exit()
  }

  async close() {
    LOG.trace('db', 'CLOSE')
    await this.db.close()
  }
}

exports.spec = require('../../../spec/db')
exports.Model = Model
