'use strict'
const Opstream = require('../lib/opstream')
const Model = require('../lib/model')

module.exports = class Data extends Opstream {
  constructor (...args) {
    super((...args) => this.#op(...args), ...args)
  }

  async #op () {
    const model = new Model()
    const bundles = await model.allBundles()
    this.push({
      tag: 'bundle',
      data: bundles.map(bundle => ({
        link: bundle.link,
        appStorage: bundle.appStorage,
        encryptionKey: bundle.encryptionKey,
        tags: bundle.tags
      }))
    })
  }
}
