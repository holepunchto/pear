'use strict'
const path = require('bare-path')
const crypto = require('hypercore-crypto')
const { PLATFORM_DIR } = require('pear-constants')
const { ERR_INVALID_INPUT } = require('pear-errors')
const Opstream = require('../lib/opstream')

module.exports = class Drop extends Opstream {
  constructor(...args) {
    super((...args) => this.#op(...args), ...args)
  }

  async #op({ link }) {
    const traits = await this.sidecar.model.getTraits(link)
    if (!traits) {
      throw ERR_INVALID_INPUT('Link was not found ' + link)
    }
    this.push({ tag: 'resetting', data: { link } })
    const oldAppStorage = traits.appStorage
    const appStoragePath = path.join(PLATFORM_DIR, 'app-storage')
    const newAppStorage = path.join(
      appStoragePath,
      'by-random',
      crypto.randomBytes(16).toString('hex')
    )
    await this.sidecar.model.updateAppStorage(link, newAppStorage, oldAppStorage)
    this.push({ tag: 'complete' })
  }
}
