'use strict'
const path = require('bare-path')
const crypto = require('hypercore-crypto')
const { PLATFORM_DIR } = require('../../../constants')
const Opstream = require('../lib/opstream')

module.exports = class Reset extends Opstream {
  constructor (...args) {
    super((...args) => this.#op(...args), ...args)
  }

  async #op ({ link }) {
    this.push({ tag: 'reseting' })
    link = link.startsWith('pear://') ? link : pathToFileURL(link).href
    const persistedBundle = await this.sidecar.model.getBundle(link)
    const appStorage = path.join(PLATFORM_DIR, 'app-storage')
    // const oldAppStorage = persistedBundle.appStorage TODO add to gc
    const newAppStorage = path.join(appStorage, 'by-random', crypto.randomBytes(16).toString('hex'))
    await this.sidecar.model.updateAppStorage(link, newAppStorage)
    this.push({ tag: 'complete' })
  }
}
