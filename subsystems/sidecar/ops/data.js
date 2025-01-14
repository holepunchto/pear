'use strict'
const Opstream = require('../lib/opstream')

module.exports = class Data extends Opstream {
  constructor (...args) {
    super((...args) => this.#op(...args), ...args)
  }

  async #op ({ resource, link }) {
    if (resource === 'apps') {
      const bundles = await this.sidecar.model.allBundles()
      this.push({ tag: 'apps', data: bundles })
    }

    if (resource === 'link') {
      const bundle = await this.sidecar.model.getBundle(link)
      this.push({ tag: 'link', data: bundle })
    }

    if (resource === 'dht') {
      const nodes = await this.sidecar.model.getDhtNodes()
      this.push({ tag: 'dht', data: nodes })
    }
  }
}
