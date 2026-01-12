'use strict'
const b4a = require('b4a')
const fs = require('bare-fs')
const HyperDB = require('hyperdb')
const DBLock = require('db-lock')
const LocalDrive = require('localdrive')
const plink = require('pear-link')
const { ERR_INVALID_LINK } = require('pear-errors')
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

module.exports = class Model {
  constructor(corestore) {
    this.db = HyperDB.rocks(corestore.storage.rocks.session(), dbSpec)
    this.lock = new Lock(this.db)
  }

  async getTraits(link) {
    const get = { link: applink(link) }
    LOG.trace('db', 'GET', '@pear/traits', get)
    const traits = await this.db.get('@pear/traits', get)
    return traits
  }

  async allTraits() {
    LOG.trace('db', 'FIND', '@pear/traits')
    return await this.db.find('@pear/traits').toArray()
  }

  async addTraits(link, appStorage) {
    const tx = await this.lock.enter()
    const traits = { link: applink(link), appStorage }
    LOG.trace('db', 'INSERT', '@pear/traits', traits)
    await tx.insert('@pear/traits', traits)
    await this.lock.exit()
    return traits
  }

  async updateEncryptionKey(link, encryptionKey) {
    let result
    const tx = await this.lock.enter()
    const get = { link: applink(link) }
    LOG.trace('db', 'GET', '@pear/traits', get)
    const traits = await tx.get('@pear/traits', get)
    if (!traits) {
      result = null
    } else {
      const update = { ...traits, encryptionKey }
      LOG.trace('db', 'INSERT', '@pear/traits', update)
      await tx.insert('@pear/traits', update)
      result = update
    }
    await this.lock.exit()
    return result
  }

  async updateAppStorage(link, newAppStorage, oldStorage) {
    let result
    const tx = await this.lock.enter()
    const get = { link: applink(link) }
    LOG.trace('db', 'GET', '@pear/traits', get)
    const traits = await tx.get('@pear/traits', get)
    if (!traits) {
      result = null
    } else {
      const insert = { ...traits, appStorage: newAppStorage }
      LOG.trace('db', 'INSERT', '@pear/traits', insert)
      await tx.insert('@pear/traits', insert)
      const gc = { path: oldStorage }
      LOG.trace('db', 'INSERT', '@pear/gc', gc)
      await tx.insert('@pear/gc', gc)
      result = insert
    }
    await this.lock.exit()
    return result
  }

  async addAsset(link, { ns, name, only, pack, path }) {
    if (!plink.parse(link)?.drive?.length)
      throw ERR_INVALID_LINK(link + ' asset links must include length')
    const tx = await this.lock.enter()
    const asset = { link, ns, name, only, pack, path }
    LOG.trace('db', 'INSERT', '@pear/assets', asset)
    await tx.insert('@pear/assets', asset)
    await this.lock.exit()
    return asset
  }

  async getAsset(link) {
    if (!plink.parse(link)?.drive?.length)
      throw ERR_INVALID_LINK('asset links must include length', { link })
    const get = { link }
    LOG.trace('db', 'GET', '@pear/assets', get)
    const asset = await this.db.get('@pear/assets', get)
    return asset
  }

  async allAssets() {
    LOG.trace('db', 'FIND', '@pear/assets')
    return await this.db.find('@pear/assets').toArray()
  }

  async allocatedAssets() {
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

  async removeAsset(link) {
    if (!plink.parse(link)?.drive?.length)
      throw ERR_INVALID_LINK(link + ' asset links must include length')
    const get = { link }
    const tx = await this.lock.enter()
    LOG.trace('db', 'GET', '@pear/assets', get)
    const asset = await tx.get('@pear/assets', get)
    if (asset) {
      if (asset.path)
        await fs.promises.rm(asset.path, { recursive: true, force: true })
      LOG.trace('db', 'DELETE', '@pear/assets', get)
      await tx.delete('@pear/assets', get)
    }
    await this.lock.exit()
    return asset
  }

  async getCurrent(link) {
    const parsed = typeof link === 'string' ? plink.parse(link) : { ...link }
    const get = { link: parsed.origin }
    LOG.trace('db', 'GET', '@pear/current', get)
    const current = await this.db.get('@pear/current', get)
    if (current !== null) {
      current.checkout.length =
        !current.key || !b4a.equals(current.key, parsed.drive.key)
          ? 0
          : current.checkout.length
    }

    return current
  }

  async allCurrents() {
    LOG.trace('db', 'FIND', '@pear/current')
    return await this.db.find('@pear/current').toArray()
  }

  async setCurrent(link, checkout) {
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

  async getTags(link) {
    const get = { link: applink(link) }
    LOG.trace('db', 'GET', '@pear/traits', get, '[tags]')
    return (await this.db.get('@pear/traits', get))?.tags || []
  }

  async updateTags(link, tags) {
    let result
    const tx = await this.lock.enter()
    const get = { link: applink(link) }
    LOG.trace('db', 'GET', '@pear/traits', get)
    const traits = await tx.get('@pear/traits', get)
    if (!traits) {
      result = null
    } else {
      const update = { ...traits, tags }
      LOG.trace('db', 'INSERT', '@pear/traits', update)
      await tx.insert('@pear/traits', update)
      result = update
    }
    await this.lock.exit()
    return result
  }

  async getAppStorage(link) {
    const get = { link: applink(link) }
    LOG.trace('db', 'GET', '@pear/traits', get)
    return (await this.db.get('@pear/traits', get))?.appStorage
  }

  async shiftAppStorage(srcLink, dstLink, newSrcAppStorage = null) {
    const tx = await this.lock.enter()
    const src = { link: applink(srcLink) }
    LOG.trace('db', 'GET', '@pear/traits', src)
    const srcBundle = await tx.get('@pear/traits', src)
    const dst = { link: applink(dstLink) }
    LOG.trace('db', 'GET', '@pear/traits', dst)
    const dstBundle = await tx.get('@pear/traits', dst)

    if (!srcBundle || !dstBundle) {
      await this.lock.exit()
      return null
    }

    const dstUpdate = { ...dstBundle, appStorage: srcBundle.appStorage }
    LOG.trace('db', 'INSERT', '@pear/traits', dstUpdate)
    await tx.insert('@pear/traits', dstUpdate)
    const gc = { path: dstBundle.appStorage }
    LOG.trace('db', 'INSERT', '@pear/gc', gc)
    await tx.insert('@pear/gc', gc)

    const srcUpdate = { ...srcBundle, appStorage: newSrcAppStorage }
    LOG.trace('db', 'INSERT', '@pear/gc', srcUpdate)
    await tx.insert('@pear/traits', srcUpdate)

    await this.lock.exit()

    return { srcBundle: srcUpdate, dstBundle: dstUpdate }
  }

  async allGc() {
    LOG.trace('db', 'FIND', '@pear/gc')
    return await this.db.find('@pear/gc').toArray()
  }

  async scavengeAssets() {
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

  async gc() {
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

  async getManifest() {
    LOG.trace('db', 'GET', '@pear/manifest')
    return await this.db.get('@pear/manifest')
  }

  async setManifest(version) {
    const manifest = { version }
    const tx = await this.lock.enter()
    LOG.trace('db', 'INSERT', '@pear/manifest', manifest)
    await tx.insert('@pear/manifest', manifest)
    await this.lock.exit()
  }

  async getPresets(link, command) {
    const get = { link: applink(link), command }
    LOG.trace('db', 'GET', '@pear/presets-by-command', get)
    const presets = await this.db.get('@pear/presets-by-command', get)
    return presets || null
  }

  async setPresets(link, command, flags) {
    const tx = await this.lock.enter()
    const presets = { link, command, flags }
    LOG.trace('db', 'INSERT', '@pear/presets', presets)
    await tx.insert('@pear/presets', presets)
    await this.lock.exit()
    return presets
  }

  async resetPresets(link, command) {
    const tx = await this.lock.enter()
    const get = { link: applink(link), command }
    LOG.trace('db', 'GET', '@pear/presets-by-command', get)
    const del = await tx.get('@pear/presets-by-command', get)
    if (del) {
      LOG.trace('db', 'DELETE', '@pear/presets-by-command', del)
      await tx.delete('@pear/presets', del)
    }
    await this.lock.exit()
  }

  async close() {
    LOG.trace('db', 'CLOSE')
    await this.db.close()
  }
}
