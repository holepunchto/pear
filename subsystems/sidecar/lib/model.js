'use strict'
const HyperDB = require('hyperdb')
const DBLock = require('db-lock')
const dbSpec = require('../../../spec/db')
const { PLATFORM_HYPERDB } = require('../../../constants')
const path = require('bare-path')

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
    const bundle = await this.db.get('@pear/bundle', { link: normalizeLink(link) })
    return bundle
  }

  async allBundles () {
    return await this.db.find('@pear/bundle').toArray()
  }

  async addBundle (link, appStorage) {
    const tx = await this.lock.enter()
    await tx.insert('@pear/bundle', { link: normalizeLink(link), appStorage })
    await this.lock.exit()
    return { link, appStorage }
  }

  async updateEncryptionKey (link, encryptionKey) {
    let result
    const tx = await this.lock.enter()
    const bundle = await tx.get('@pear/bundle', { link: normalizeLink(link) })
    if (!bundle) {
      result = null
    } else {
      const updatedBundle = { ...bundle, encryptionKey }
      await tx.insert('@pear/bundle', updatedBundle)
      result = updatedBundle
    }
    await this.lock.exit()
    return result
  }

  async updateAppStorage (link, newAppStorage, oldStorage) {
    let result
    const tx = await this.lock.enter()
    const bundle = await tx.get('@pear/bundle', { link: normalizeLink(link) })
    if (!bundle) {
      result = null
    } else {
      const updatedBundle = { ...bundle, appStorage: newAppStorage }
      await tx.insert('@pear/bundle', updatedBundle)
      await tx.insert('@pear/gc', { path: oldStorage })
      result = updatedBundle
    }
    await this.lock.exit()
    return result
  }

  async getDhtNodes () {
    return (await this.db.get('@pear/dht'))?.nodes || []
  }

  async setDhtNodes (nodes) {
    const tx = await this.lock.enter()
    await tx.insert('@pear/dht', { nodes })
    await this.lock.exit()
  }

  async getTags (link) {
    return (await this.db.get('@pear/bundle', { link: normalizeLink(link) }))?.tags || []
  }

  async updateTags (link, tags) {
    let result
    const tx = await this.lock.enter()
    const bundle = await tx.get('@pear/bundle', { link: normalizeLink(link) })
    if (!bundle) {
      result = null
    } else {
      const updatedBundle = { ...bundle, tags }
      await tx.insert('@pear/bundle', updatedBundle)
      result = updatedBundle
    }
    await this.lock.exit()
    return result
  }

  async getAppStorage (link) {
    return (await this.db.get('@pear/bundle', { link: normalizeLink(link) }))?.appStorage
  }

  async shiftAppStorage (srcLink, dstLink, newSrcAppStorage = null) {
    const tx = await this.lock.enter()
    const srcBundle = await tx.get('@pear/bundle', { link: normalizeLink(srcLink) })
    const dstBundle = await tx.get('@pear/bundle', { link: normalizeLink(dstLink) })

    if (!srcBundle || !dstBundle) {
      await this.lock.exit()
      return null
    }

    const updatedDstBundle = { ...dstBundle, appStorage: srcBundle.appStorage }
    await tx.insert('@pear/bundle', updatedDstBundle)
    await tx.insert('@pear/gc', { path: dstBundle.appStorage })

    const updatedSrcBundle = { ...srcBundle, appStorage: newSrcAppStorage }
    await tx.insert('@pear/bundle', updatedSrcBundle)

    await this.lock.exit()

    return { srcBundle: updatedSrcBundle, dstBundle: updatedDstBundle }
  }

  async close () {
    await this.db.close()
  }
}

const normalizeLink = (link) => {
  return link.endsWith(path.sep) ? link.slice(0, -1) : link
}
