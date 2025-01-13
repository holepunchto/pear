'use strict'
const Opstream = require('../lib/opstream')
const Model = require('../lib/model')

module.exports = class Data extends Opstream {
  constructor (...args) {
    super((...args) => this.#op(...args), ...args)
  }

  async #op ({ resource, link }) {
    const model = new Model()

    if (resource === 'apps') {
      const bundles = await model.allBundles()
      this.push({ tag: 'apps', data: bundles })
    }

    if (resource === 'link') {
      const bundle = await model.getBundle(link)
      this.push({ tag: 'link', data: bundle ? [bundle] : [] })
    }

    if (resource === 'dht') {
      const nodes = await model.getDhtNodes()
      this.push({ tag: 'dht', data: { nodes } })
    }

    await model.close()
  }
}
