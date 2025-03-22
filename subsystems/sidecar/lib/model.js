'use strict'
const fs = require('bare-fs')
const pearLink = require('pear-link')
const HyperDB = require('hyperdb')
const DBLock = require('db-lock')
const dbSpec = require('../../../spec/db')
const { PLATFORM_HYPERDB } = require('pear-api/constants')

module.exports = class Model {
  constructor () {
    this.init()
  }

  init () {
    LOG.trace('db', `ROCKS ('${PLATFORM_HYPERDB}')`)
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
    link = pearLink.root(link)
    LOG.trace('db', `GET ('@pear/bundle', ${JSON.stringify({ link })})`)
    const bundle = await this.db.get('@pear/bundle', { link })
    return bundle
  }

  async allBundles () {
    LOG.trace('db', 'FIND (\'@pear/bundle\')')
    return await this.db.find('@pear/bundle').toArray()
  }

  async addBundle (link, appStorage) {
    link = pearLink.root(link)
    const tx = await this.lock.enter()
    LOG.trace('db', `INSERT ('@pear/bundle', ${JSON.stringify({ link, appStorage })})`)
    await tx.insert('@pear/bundle', { link, appStorage })
    await this.lock.exit()
    return { link, appStorage }
  }

  async updateEncryptionKey (link, encryptionKey) {
    let result
    const tx = await this.lock.enter()
    LOG.trace('db', `GET ('@pear/bundle', ${JSON.stringify({ link })} })`)
    const bundle = await tx.get('@pear/bundle', { link })
    if (!bundle) {
      result = null
    } else {
      const updatedBundle = { ...bundle, encryptionKey }
      LOG.trace('db', `INSERT ('@pear/bundle', ${JSON.stringify({ ...bundle, encryptionKey })})`)
      await tx.insert('@pear/bundle', updatedBundle)
      result = updatedBundle
    }
    await this.lock.exit()
    return result
  }

  async updateAppStorage (link, newAppStorage, oldStorage) {
    let result
    const tx = await this.lock.enter()
    LOG.trace('db', `GET ('@pear/bundle', { link: ${link} })`)
    const bundle = await tx.get('@pear/bundle', { link })
    if (!bundle) {
      result = null
    } else {
      const updatedBundle = { ...bundle, appStorage: newAppStorage }
      LOG.trace('db', `INSERT ('@pear/bundle', ${JSON.stringify(updatedBundle)})`)
      await tx.insert('@pear/bundle', updatedBundle)
      LOG.trace('db', `INSERT ('@pear/gc', ${JSON.stringify({ path: oldStorage })})`)
      await tx.insert('@pear/gc', { path: oldStorage })
      result = updatedBundle
    }
    await this.lock.exit()
    return result
  }

  async getDhtNodes () {
    LOG.trace('db', 'GET (\'@pear/dht\')[nodes]')
    return (await this.db.get('@pear/dht'))?.nodes || []
  }

  async setDhtNodes (nodes) {
    const tx = await this.lock.enter()
    LOG.trace('db', `INSERT ('@pear/dht', ${JSON.stringify(nodes)})`)
    await tx.insert('@pear/dht', { nodes })
    await this.lock.exit()
  }

  async getTags (link) {
    LOG.trace('db', `GET ('@pear/bundle', ${JSON.stringify({ link })})[tags]`)
    return (await this.db.get('@pear/bundle', { link }))?.tags || []
  }

  async updateTags (link, tags) {
    let result
    const tx = await this.lock.enter()
    LOG.trace('db', `GET ('@pear/bundle', { link: ${link} })`)
    const bundle = await tx.get('@pear/bundle', { link })
    if (!bundle) {
      result = null
    } else {
      const updatedBundle = { ...bundle, tags }
      LOG.trace('db', `INSERT ('@pear/bundle', ${JSON.stringify(updatedBundle)})`)
      await tx.insert('@pear/bundle', updatedBundle)
      result = updatedBundle
    }
    await this.lock.exit()
    return result
  }

  async getAppStorage (link) {
    return (await this.db.get('@pear/bundle', { link }))?.appStorage
  }

  async shiftAppStorage (srcLink, dstLink, newSrcAppStorage = null) {
    const tx = await this.lock.enter()
    LOG.trace('db', `GET ('@pear/bundle', { link: ${srcLink} })`)
    const srcBundle = await tx.get('@pear/bundle', { link: srcLink })
    LOG.trace('db', `GET ('@pear/bundle', { link: ${dstLink} })`)
    const dstBundle = await tx.get('@pear/bundle', { link: dstLink })

    if (!srcBundle || !dstBundle) {
      await this.lock.exit()
      return null
    }

    const updatedDstBundle = { ...dstBundle, appStorage: srcBundle.appStorage }
    LOG.trace('db', `INSERT ('@pear/bundle', ${JSON.stringify(updatedDstBundle)})`)
    await tx.insert('@pear/bundle', updatedDstBundle)
    LOG.trace('db', `INSERT ('@pear/gc', ${JSON.stringify({ path: dstBundle.appStorage })})`)
    await tx.insert('@pear/gc', { path: dstBundle.appStorage })

    const updatedSrcBundle = { ...srcBundle, appStorage: newSrcAppStorage }
    LOG.trace('db', `INSERT ('@pear/gc', ${JSON.stringify(updatedSrcBundle)})`)
    await tx.insert('@pear/bundle', updatedSrcBundle)

    await this.lock.exit()

    return { srcBundle: updatedSrcBundle, dstBundle: updatedDstBundle }
  }

  async allGc () {
    LOG.trace('db', 'FIND (\'@pear/gc\')')
    return await this.db.find('@pear/gc').toArray()
  }

  async close () {
    LOG.trace('db', 'CLOSE')
    await this.db.close()
  }

  async reset () {
    await this.close()
    await fs.promises.rm(PLATFORM_HYPERDB, { recursive: true, force: true })
    this.init()
  }
}
