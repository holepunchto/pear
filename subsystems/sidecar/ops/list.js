'use strict'
const Opstream = require('../lib/opstream')

module.exports = class List extends Opstream {
  constructor (...args) {
    super((...args) => this.#op(...args), ...args)
  }

  async #op ({ bundles }) {
    const all = await this.model.allBundles()
    this.push({
      tag: bundles ? 'bundles' : 'all',
      data: all.map(b => ({
        link: b.link,
        appStorage: b.appStorage,
        encryptionKey: b.encryptionKey,
        tags: b.tags
      }))
    })
  }
}
