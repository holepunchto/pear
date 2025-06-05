'use strict'
const fs = require('bare-fs')
const path = require('bare-path')
const HyperDB = require('hyperdb')
const DBLock = require('db-lock')
const LocalDrive = require('localdrive')
const plink = require('pear-api/link')
const dbSpec = require('../../../spec/db')
const { PLATFORM_DIR } = require('pear-api/constants')
const { randomBytes } = require('hypercore-crypto')

const origin = (link) => typeof link === 'string' ? plink.parse(link).origin : link.origin

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
    const get = { link: origin(link) }
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
    const bundle = { link: origin(link), appStorage }
    LOG.trace('db', 'INSERT', '@pear/bundle', bundle)
    await tx.insert('@pear/bundle', bundle)
    await this.lock.exit()
    return bundle
  }

  async updateEncryptionKey (link, encryptionKey) {
    let result
    const tx = await this.lock.enter()
    const get = { link: origin(link) }
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
    const get = { link: origin(link) }
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

  async touchAsset (link) {
    const tx = await this.lock.enter()
    const get = { link }
    LOG.trace('db', 'GET', '@pear/asset', get)
    const asset = await tx.get('@pear/asset', get) ?? get
    if (!asset.path) {
      asset.path = path.join(PLATFORM_DIR, 'assets', randomBytes(16).toString('hex'))
      asset.bytesAllocated = 0
      LOG.trace('db', 'INSERT', '@pear/asset', asset)
      await tx.insert('@pear/asset', asset)
      asset.inserted = true
    } else {
      asset.inserted = false
    }
    await this.lock.exit()
    return asset
  }

  async getAsset (link) {
    const get = { link }
    LOG.trace('db', 'GET', '@pear/asset', get)
    const asset = await this.db.get('@pear/asset', get)
    return asset
  }

  async allAssets () {
    LOG.trace('db', 'FIND', '@pear/asset')
    const assets = await this.db.find('@pear/asset').toArray()
    let totalAllocated = 0
    for (const asset of assets) {
      if (asset.bytesAllocated === 0) {
        let bytesAllocated = 0
        const drive = new LocalDrive(asset.path)
        for await (const entry of drive.list('/')) {
          if (entry.value.blob) bytesAllocated += entry.value.blob.byteLength
        }
        const tx = await this.lock.enter()
        const update = { ...asset, bytesAllocated }
        LOG.trace('db', 'INSERT', '@pear/asset', update)
        await tx.insert('@pear/asset', update)
        await this.lock.exit()
        asset.bytesAllocated = bytesAllocated
      }
      totalAllocated += asset.bytesAllocated
    }
    return { assets, totalAllocated }
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
    const get = { link }
    LOG.trace('db', 'GET', '@pear/bundle', get, '[tags]')
    return (await this.db.get('@pear/bundle', get))?.tags || []
  }

  async updateTags (link, tags) {
    let result
    const tx = await this.lock.enter()
    const get = { link }
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
    const get = { link: origin(link) }
    LOG.trace('db', 'GET', '@pear/bundle', get)
    return (await this.db.get('@pear/bundle', get))?.appStorage
  }

  async shiftAppStorage (srcLink, dstLink, newSrcAppStorage = null) {
    const tx = await this.lock.enter()
    const src = { link: origin(srcLink) }
    LOG.trace('db', 'GET', '@pear/bundle', src)
    const srcBundle = await tx.get('@pear/bundle', src)
    const dst = { link: origin(dstLink) }
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

  async gc () {
    const { totalAllocated } = await this.allAssets()
    const maxCapacity = 12 * 1024 ** 3
    if (totalAllocated > maxCapacity) {
      const tx = await this.lock.enter()
      LOG.trace('db', 'FIND ONE', '@pear/asset')
      const asset = await tx.findOne('@pear/asset')
      if (asset) {
        const gc = { path: asset.path }
        LOG.trace('db', 'INSERT', '@pear/gc', gc)
        await tx.insert('@pear/gc', gc)
        LOG.trace('db', 'DELETE', '@pear/asset', asset)
        await tx.delete('@pear/asset', asset)
      }
      await this.lock.exit()
    }

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
