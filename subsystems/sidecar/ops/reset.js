'use strict'
const path = require('bare-path')
const crypto = require('hypercore-crypto')
const { pathToFileURL } = require('url-file-url')
const { PLATFORM_DIR } = require('../../../constants')
const Opstream = require('../lib/opstream')
const { ERR_INVALID_INPUT } = require('../../../errors')

module.exports = class Reset extends Opstream {
  constructor (...args) {
    super((...args) => this.#op(...args), ...args)
  }

  async #op ({ link }) {
    link = link.startsWith('pear://') ? link : pathToFileURL(link).href
    const persistedBundle = await this.sidecar.model.getBundle(link)
    if (!persistedBundle) {
      throw ERR_INVALID_INPUT('Link was not found')
    }
    this.push({ tag: 'reseting', data: { link } })
    const oldAppStorage = persistedBundle.appStorage
    const appStoragePath = path.join(PLATFORM_DIR, 'app-storage')
    const newAppStorage = path.join(appStoragePath, 'by-random', crypto.randomBytes(16).toString('hex'))
    await this.sidecar.model.updateAppStorage(link, newAppStorage, oldAppStorage)
    this.push({ tag: 'complete' })
  }
}
