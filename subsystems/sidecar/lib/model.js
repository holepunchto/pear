'use strict'
const fs = require('bare-fs')
const HyperDB = require('hyperdb')
const DBLock = require('db-lock')
const LocalDrive = require('localdrive')
const plink = require('pear-api/link')
const { ERR_INVALID_LINK } = require('pear-api/errors')
const dbSpec = require('../../../spec/db')

const applink = (link, { alias = true } = {}) => {
  const parsed = typeof link === 'string' ? plink.parse(link) : { ...link }
  if (alias === false) parsed.alias = null
  const ser = plink.serialize(parsed)
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
    LOG.trace('db', 'INSERT', '@pear/assets', asset)
    await tx.insert('@pear/assets', asset)
    await this.lock.exit()
    return asset
  }

  async getAsset (link) {
    if (!plink.parse(link)?.drive?.length) throw ERR_INVALID_LINK(link + ' asset links must include length')
    const get = { link }
    LOG.trace('db', 'GET', '@pear/assets', get)
    const asset = await this.db.get('@pear/assets', get)
    return asset
  }

  async allAssets () {
    LOG.trace('db', 'FIND', '@pear/assets')
    return await this.db.find('@pear/assets').toArray()
  }

  async allocatedAssets () {
    LOG.trace('db', 'FIND', '@pear/assets')
    const assets = await this.db.find('@pear/assets').toArray()
    let totalBytes = 0
    for (const asset of assets) {
      if (!asset.bytes) {
        let bytes = 0
        const drive = new LocalDrive(asset.path)
        for await (const entry of drive.list('/')) {
          if (entry.value.blob) bytes += entry.value.blob.byteLength
        }
        const tx = await this.lock.enter()
        const update = { ...asset, bytes }
        LOG.trace('db', 'INSERT', '@pear/assets', update)
        await tx.insert('@pear/assets', update)
        await this.lock.exit()
        asset.bytes = bytes
      }
      totalBytes += asset.bytes
    }
    return totalBytes
  }

  async removeAsset (link) {
    if (!plink.parse(link)?.drive?.length) throw ERR_INVALID_LINK(link + ' asset links must include length')
    const get = { link }
    const tx = await this.lock.enter()
    LOG.trace('db', 'GET', '@pear/assets', get)
    const asset = await tx.get('@pear/assets', get)
    if (asset) {
      if (asset.path) await fs.promises.rm(asset.path, { recursive: true, force: true })
      LOG.trace('db', 'DELETE', '@pear/assets', get)
      await tx.delete('@pear/assets', get)
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

  async allCurrents () {
    LOG.trace('db', 'FIND', '@pear/current')
    return await this.db.find('@pear/current').toArray()
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

  async addAsset (link, { ns, name, only, path }) {
    const tx = await this.lock.enter()
    const asset = { link, ns, name, only, path }
    LOG.trace('db', 'INSERT', '@pear/assets', asset)
    await tx.insert('@pear/assets', asset)
    await this.lock.exit()
    return asset
  }

  async getAsset (link) {
    const get = { link }
    LOG.trace('db', 'GET', '@pear/assets', get)
    const asset = await this.db.get('@pear/assets', get)
    return asset
  }

  async allocatedAssets () {
    LOG.trace('db', 'FIND', '@pear/assets')
    const assets = await this.db.find('@pear/assets').toArray()
    let totalBytes = 0
    for (const asset of assets) {
      if (!asset.bytes) {
        let bytes = 0
        const drive = new LocalDrive(asset.path)
        for await (const entry of drive.list('/')) {
          if (entry.value.blob) bytes += entry.value.blob.byteLength
        }
        const tx = await this.lock.enter()
        const update = { ...asset, bytes }
        LOG.trace('db', 'INSERT', '@pear/assets', update)
        await tx.insert('@pear/assets', update)
        await this.lock.exit()
        asset.bytes = bytes
      }
      totalBytes += asset.bytes
    }
    return totalBytes
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

  async scavengeAssets () {
    const totalBytes = await this.allocatedAssets()
    const maxCapacity = 12 * 1024 ** 3 // 12 GiB
    if (totalBytes > maxCapacity) {
      const tx = await this.lock.enter()
      LOG.trace('db', 'FIND ONE', '@pear/assets')
      const asset = await tx.findOne('@pear/assets')
      if (asset) {
        const gc = { path: asset.path }
        LOG.trace('db', 'INSERT', '@pear/gc', gc)
        await tx.insert('@pear/gc', gc)
        LOG.trace('db', 'DELETE', '@pear/assets', asset)
        await tx.delete('@pear/assets', asset)
      }
      await this.lock.exit()
    }
  }

  async gc () {
    LOG.trace('db', 'FIND ONE', '@pear/gc')
    const entry = await this.db.findOne('@pear/gc')
    if (entry) {
      LOG.trace('db', 'GC removing directory', entry.path)
      await fs.promises.rm(entry.path, { recursive: true, force: true })
      const get = { path: entry.path }
      const tx = await this.lock.enter()
      LOG.trace('db', 'DELETE', '@pear/gc', get)
      await tx.delete('@pear/gc', get)
      await this.lock.exit()
    } else {
      LOG.trace('db', 'GC is clear')
    }
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
