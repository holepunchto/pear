'use strict'
const HyperDB = require('hyperdb')
const DBLock = require('db-lock')
const dbSpec = require('../../../spec/db')
const { PLATFORM_HYPERDB } = require('../../../constants')

module.exports = class Model {
  constructor () {
    this.db = HyperDB.rocks(PLATFORM_HYPERDB, dbSpec)

    this.lock = new DBLock({
      enter: () => {
        return this.db.transaction()
      },
      exit: tx => {
        return tx.flush()
      },
      maxParallel: 1
    })
  }

  async getBundle (link) {
    return await this.db.get('@pear/bundle', { link })
  }

  async allBundles () {
    return await this.db.find('@pear/bundle').toArray()
  }

  async addBundle (link, encryptionKey) {
    const tx = await this.lock.enter()
    await tx.insert('@pear/bundle', { link, appStorage: this.#appStorage(link), encryptionKey })
    await this.lock.exit()
  }

  async getDhtNodes () {
    return (await this.db.get('@pear/dht'))?.nodes || []
  }

  async setDhtNodes (nodes) {
    const tx = await this.lock.enter()
    await tx.insert('@pear/dht', { nodes })
    await this.lock.exit()
  }

  async close () {
    await this.db.flush()
    await this.db.close()
  }

  #appStorage (link) {
    return link
  }
}
