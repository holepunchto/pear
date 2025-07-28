'use strict'
const Opstream = require('../lib/opstream')

module.exports = class Data extends Opstream {
  constructor (...args) {
    super((...args) => this.#op(...args), ...args)
  }

  async #op ({ resource, secrets, link }) {
    if (resource === 'apps') {
      let bundles = await this.sidecar.model.allBundles()
      if (!secrets) bundles = bundles.map(({ encryptionKey, ...rest }) => rest)
      this.push({ tag: 'apps', data: bundles })
    }

    if (resource === 'link') {
      const bundle = await this.sidecar.model.getBundle(link)
      if (bundle && !secrets) bundle.encryptionKey = undefined
      this.push({ tag: 'link', data: bundle })
    }

    if (resource === 'dht') {
      const nodes = await this.sidecar.model.getDhtNodes()
      this.push({ tag: 'dht', data: nodes })
    }

    if (resource === 'gc') {
      const records = await this.sidecar.model.allGc()
      this.push({ tag: 'gc', data: records })
    }
  }
}
