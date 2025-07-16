'use strict'
const fs = require('bare-fs')
const HyperDB = require('hyperdb')
const DBLock = require('db-lock')
const plink = require('pear-api/link')
const { ERR_INVALID_LINK } = require('pear-api/errors')
const dbSpec = require('../../../spec/db')

const applink = (link, { alias = true } = {}) => {
  console.log('APPLINK', link)
  const parsed = typeof link === 'string' ? plink.parse(link) : { ...link }
  if (alias === false) parsed.alias = null
  const ser = plink.serialize(parsed)
  console.log('SER', ser)
  return plink.parse(ser).origin
}

class Lock extends DBLock {
  #manual = false
  #tx = null
  constructor (db) {
    super({
      enter: () => {
        this.#tx = db.transaction()
        return this.#tx
      },
      exit: (tx) => tx.flush(),
      maxParallel: 1
    })
  }

  enter () {
    if (this.#manual && this.#tx !== null) return this.#tx
    return super.enter()
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
    const get = { link: applink(link) }
    LOG.trace('db', 'GET', '@pear/bundle', get)
    const bundle = await this.db.get('@pear/bundle', get)
    return bundle
  }

  async allBundles () {
    LOG.trace('db', 'FIND', '@pear/bundle')
    return await this.db.find('@pear/bundle').toArray()
  }

  async addBundle (link, appStorage) {
    const tx = await this.lock.enter()
    const bundle = { link: applink(link), appStorage }
    LOG.trace('db', 'INSERT', '@pear/bundle', bundle)
    await tx.insert('@pear/bundle', bundle)
    await this.lock.exit()
    return bundle
  }

  async updateEncryptionKey (link, encryptionKey) {
    let result
    const tx = await this.lock.enter()
    const get = { link: applink(link) }
    LOG.trace('db', 'GET', '@pear/bundle', get)
    const bundle = await tx.get('@pear/bundle', get)
    if (!bundle) {
      result = null
    } else {
      const update = { ...bundle, encryptionKey }
      LOG.trace('db', 'INSERT', '@pear/bundle', update)
      await tx.insert('@pear/bundle', update)
      result = update
    }
    await this.lock.exit()
    return result
  }

  async updateAppStorage (link, newAppStorage, oldStorage) {
    let result
    const tx = await this.lock.enter()
    const get = { link: applink(link) }
    LOG.trace('db', 'GET', '@pear/bundle', get)
    const bundle = await tx.get('@pear/bundle', get)
    if (!bundle) {
      result = null
    } else {
      const insert = { ...bundle, appStorage: newAppStorage }
      LOG.trace('db', 'INSERT', '@pear/bundle', insert)
      await tx.insert('@pear/bundle', insert)
      const gc = { path: oldStorage }
      LOG.trace('db', 'INSERT', '@pear/gc', gc)
      await tx.insert('@pear/gc', gc)
      result = insert
    }
    await this.lock.exit()
    return result
  }

  async addAsset (link, { ns, name, only, path }) {
    if (!plink.parse(link)?.drive?.length) throw ERR_INVALID_LINK(link + ' asset links must include length')
    const tx = await this.lock.enter()
    const asset = { link, ns, name, only, path }
    LOG.trace('db', 'INSERT', '@pear/asset', asset)
    await tx.insert('@pear/asset', asset)
    await this.lock.exit()
    return asset
  }

  async getAsset (link) {
    if (!plink.parse(link)?.drive?.length) throw ERR_INVALID_LINK(link + ' asset links must include length')
    const get = { link }
    LOG.trace('db', 'GET', '@pear/asset', get)
    const asset = await this.db.get('@pear/asset', get)
    return asset
  }

  async allAssets () {
    LOG.trace('db', 'FIND', '@pear/asset')
    return await this.db.find('@pear/asset').toArray()
  }

  async removeAsset (link) {
    if (!plink.parse(link)?.drive?.length) throw ERR_INVALID_LINK(link + ' asset links must include length')
    const get = { link }
    const tx = await this.lock.enter()
    LOG.trace('db', 'GET', '@pear/asset', get)
    const asset = await tx.get('@pear/asset', get)
    if (asset) {
      if (asset.path) await fs.promises.rm(asset.path, { recursive: true, force: true })
      LOG.trace('db', 'DELETE', '@pear/asset', get)
      await tx.delete('@pear/asset', get)
    }
    await this.lock.exit()
    return asset
  }

  async getCurrent (link) {
    const get = { link: applink(link, { alias: false }) }
    LOG.trace('db', 'GET', '@pear/current', get)
    const current = await this.db.get('@pear/current', get)
    return current
  }

  async setCurrent (link, checkout) {
    const tx = await this.lock.enter()
    const current = {
      link: applink(link, { alias: false }),
      checkout: { fork: checkout.fork, length: checkout.length }
    }
    LOG.trace('db', 'INSERT', '@pear/current', current)
    const result = await tx.insert('@pear/current', current)
    await this.lock.exit()
    return result
  }

  async getDhtNodes () {
    LOG.trace('db', 'GET', '@pear/dht', '[nodes]')
    return (await this.db.get('@pear/dht'))?.nodes || []
  }

  async setDhtNodes (nodes) {
    const tx = await this.lock.enter()
    const insert = { nodes }
    LOG.trace('db', 'INSERT', '@pear/dht', insert)
    await tx.insert('@pear/dht', insert)
    await this.lock.exit()
  }

  async getTags (link) {
    const get = { link: applink(link) }
    LOG.trace('db', 'GET', '@pear/bundle', get, '[tags]')
    return (await this.db.get('@pear/bundle', get))?.tags || []
  }

  async updateTags (link, tags) {
    let result
    const tx = await this.lock.enter()
    const get = { link: applink(link) }
    LOG.trace('db', 'GET', '@pear/bundle', get)
    const bundle = await tx.get('@pear/bundle', get)
    if (!bundle) {
      result = null
    } else {
      const update = { ...bundle, tags }
      LOG.trace('db', 'INSERT', '@pear/bundle', update)
      await tx.insert('@pear/bundle', update)
      result = update
    }
    await this.lock.exit()
    return result
  }

  async getAppStorage (link) {
    const get = { link: applink(link) }
    LOG.trace('db', 'GET', '@pear/bundle', get)
    return (await this.db.get('@pear/bundle', get))?.appStorage
  }

  async shiftAppStorage (srcLink, dstLink, newSrcAppStorage = null) {
    const tx = await this.lock.enter()
    const src = { link: applink(srcLink) }
    LOG.trace('db', 'GET', '@pear/bundle', src)
    const srcBundle = await tx.get('@pear/bundle', src)
    const dst = { link: applink(dstLink) }
    LOG.trace('db', 'GET', '@pear/bundle', dst)
    const dstBundle = await tx.get('@pear/bundle', dst)

    if (!srcBundle || !dstBundle) {
      await this.lock.exit()
      return null
    }

    const dstUpdate = { ...dstBundle, appStorage: srcBundle.appStorage }
    LOG.trace('db', 'INSERT', '@pear/bundle', dstUpdate)
    await tx.insert('@pear/bundle', dstUpdate)
    const gc = { path: dstBundle.appStorage }
    LOG.trace('db', 'INSERT', '@pear/gc', gc)
    await tx.insert('@pear/gc', gc)

    const srcUpdate = { ...srcBundle, appStorage: newSrcAppStorage }
    LOG.trace('db', 'INSERT', '@pear/gc', srcUpdate)
    await tx.insert('@pear/bundle', srcUpdate)

    await this.lock.exit()

    return { srcBundle: srcUpdate, dstBundle: dstUpdate }
  }

  async allGc () {
    LOG.trace('db', 'FIND', '@pear/gc')
    return await this.db.find('@pear/gc').toArray()
  }

  async getManifest () {
    LOG.trace('db', 'GET', '@pear/manifest')
    return await this.db.get('@pear/manifest')
  }

  async setManifest (version) {
    const manifest = { version }
    const tx = await this.lock.enter()
    LOG.trace('db', 'INSERT', '@pear/manifest', manifest)
    await tx.insert('@pear/manifest', manifest)
    await this.lock.exit()
  }

  async close () {
    LOG.trace('db', 'CLOSE')
    await this.db.close()
  }
}
