'use strict'
const Opstream = require('../lib/opstream')

module.exports = class Data extends Opstream {
  constructor (...args) {
    super((...args) => this.#op(...args), ...args)
  }

  async #op ({ resource, secrets, link }) {
    if (resource === 'apps') {
      let bundles
      if (link) {
        const bundle = await this.sidecar.model.getBundle(link)
        bundles = bundle ? [bundle] : []
      } else {
        bundles = await this.sidecar.model.allBundles()
      }
      if (!secrets) bundles = bundles.map(({ encryptionKey, ...rest }) => rest)
      this.push({ tag: 'apps', data: bundles })
    }

    if (resource === 'dht') {
      const nodes = await this.sidecar.model.getDhtNodes()
      this.push({ tag: 'dht', data: nodes })
    }

    if (resource === 'gc') {
      const records = await this.sidecar.model.allGc()
      this.push({ tag: 'gc', data: records })
    }

    if (resource === 'manifest') {
      const manifest = await this.sidecar.model.getManifest()
      this.push({ tag: 'manifest', data: manifest })
    }

    if (resource === 'assets') {
      let assets
      if (link) {
        const asset = await this.sidecar.model.getAsset(link)
        assets = asset ? [asset] : []
      } else {
        assets = await this.sidecar.model.allAssets()
      }
      this.push({ tag: 'assets', data: assets })
    }
  }
}
