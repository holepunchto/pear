'use strict'
const path = require('bare-path')
const HyperDB = require('hyperdb')
const DBLock = require('db-lock')
const plink = require('pear-api/link')
const dbSpec = require('../../../spec/db')
const { PLATFORM_DIR } = require('pear-api/constants')
const { pathToFileURL } = require('url-file-url')
const { randomBytes } = require('hypercore-crypto')

class Lock extends DBLock {
  #manual = false
  constructor (db) {
    super({
      enter: () => db.transaction(),
      exit: (tx) => tx.flush(),
      maxParallel: 1
    })
  }

  exit () {
    if (this.#manual) return Promise.resolve()
    return super.exit()
  }

  manual () {
    this.#manual = true
    return async () => {
      try { await super.exit() } finally { this.#manual = false }
    }
  }
}

module.exports = class Model {
  constructor (corestore) {
    this.db = HyperDB.rocks(corestore.storage.rocks.session(), dbSpec)
    this.lock = new Lock(this.db)
  }

  async getBundle (link) {
    const isPearLink = link.startsWith('pear://')
    const isFileUrl = link.startsWith('file://')
    link = isPearLink || isFileUrl ? link : pathToFileURL(link).href
    const { origin } = plink.parse(link)
    LOG.trace('db', `GET ('@pear/bundle', ${JSON.stringify({ link: origin })})`)
    const bundle = await this.db.get('@pear/bundle', { link: origin })
    return bundle
  }

  async allBundles () {
    LOG.trace('db', 'FIND (\'@pear/bundle\')')
    return await this.db.find('@pear/bundle').toArray()
  }

  async addBundle (link, appStorage) {
    const { origin } = plink.parse(link)
    LOG.trace('db', `INSERT ('@pear/bundle', ${JSON.stringify({ link: origin, appStorage })})`)
    const tx = await this.lock.enter()
    await tx.insert('@pear/bundle', { link: origin, appStorage })
    await this.lock.exit()
    return { link, appStorage }
  }

  async updateEncryptionKey (link, encryptionKey) {
    let result
    const tx = await this.lock.enter()
    LOG.trace('db', `GET ('@pear/bundle', ${JSON.stringify({ link })})`)
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

  async touchAsset (link) {
    const tx = await this.lock.enter()
    LOG.trace('db', `GET ('@pear/asset', ${JSON.stringify({ link })})`)
    const asset = await tx.get('@pear/asset', { link }) ?? { link }
    if (!asset.path) {
      asset.path = path.join(PLATFORM_DIR, 'assets', randomBytes(16).toString('hex'))
      LOG.trace('db', `INSERT ('@pear/asset', ${JSON.stringify(asset)})`)
      await tx.insert('@pear/asset', asset)
      asset.inserted = true
    } else {
      asset.inserted = false
    }
    await this.lock.exit()
    return asset
  }

  async getDhtNodes () {
    LOG.trace('db', 'GET (\'@pear/dht\')[nodes]')
    return (await this.db.get('@pear/dht'))?.nodes || []
  }

  async setDhtNodes (nodes) {
    LOG.trace('db', `INSERT ('@pear/dht', ${JSON.stringify(nodes)})`)
    const tx = await this.lock.enter()
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
    LOG.trace('db', `GET ('@pear/bundle', ${JSON.stringify({ link })})[appStorage]`)
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
    LOG.trace('db', `INSERT ('@pear/bundle', ${JSON.stringify(updatedSrcBundle)})`)
    await tx.insert('@pear/bundle', updatedSrcBundle)

    await this.lock.exit()

    return { srcBundle: updatedSrcBundle, dstBundle: updatedDstBundle }
  }

  async allGc () {
    LOG.trace('db', 'FIND (\'@pear/gc\')')
    return await this.db.find('@pear/gc').toArray()
  }

  async getManifest () {
    LOG.trace('db', 'GET (\'@pear/manifest\')')
    return await this.db.get('@pear/manifest')
  }

  async setManifest (version) {
    const manifest = { version }
    LOG.trace('db', 'INSERT', '@pear/manifest', manifest)
    const tx = await this.lock.enter()
    await tx.insert('@pear/manifest', manifest)
    await this.lock.exit()
  }

  async close () {
    LOG.trace('db', 'CLOSE')
    await this.db.close()
  }
}
