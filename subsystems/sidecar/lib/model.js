'use strict'
const fs = require('bare-fs')
const HyperDB = require('hyperdb')
const DBLock = require('db-lock')
const pearLink = require('pear-link')
const LocalDrive = require('localdrive')
const dbSpec = require('../../../spec/db')
const { PLATFORM_HYPERDB, ALIASES } = require('pear-api/constants')

module.exports = class Model {
  constructor (corestore) {
    this.db = HyperDB.rocks(corestore.storage.rocks.session(), dbSpec)

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
    const { origin } = pearLink(ALIASES)(link)
    LOG.trace('db', `GET ('@pear/bundle', ${JSON.stringify({ link: origin })})`)
    const bundle = await this.db.get('@pear/bundle', { link: origin })
    return bundle
  }

  async allBundles () {
    LOG.trace('db', 'FIND (\'@pear/bundle\')')
    return await this.db.find('@pear/bundle').toArray()
  }

  async addBundle (link, appStorage) {
    const { origin } = pearLink(ALIASES)(link)
    const tx = await this.lock.enter()
    LOG.trace('db', `INSERT ('@pear/bundle', ${JSON.stringify({ link: origin, appStorage })})`)
    await tx.insert('@pear/bundle', { link: origin, appStorage })
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
