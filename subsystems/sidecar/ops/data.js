'use strict'
const { ERR_NOT_FOUND } = require('pear-errors')
const Opstream = require('../lib/opstream')

module.exports = class Data extends Opstream {
  constructor(...args) {
    super((...args) => this.#op(...args), ...args)
  }

  async #op({ resource, secrets, link }) {
    await this.sidecar.ready()

    if (resource === 'apps') {
      let data
      if (link) {
        const traits = await this.sidecar.model.getTraits(link)
        if (traits === null) throw ERR_NOT_FOUND('app not found', { link })
        data = [traits]
      } else {
        data = await this.sidecar.model.allTraits()
      }
      if (!secrets) data = data.map(({ encryptionKey, ...rest }) => rest)
      this.push({ tag: 'apps', data })
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
      await this.sidecar.model.allocatedAssets()
      let assets
      if (link) {
        const asset = await this.sidecar.model.getAsset(link)
        if (asset === null) throw ERR_NOT_FOUND(link + ' not found', { link })
        assets = [asset]
        this.push({ tag: 'assets', data: assets })
      } else {
        const assets = await this.sidecar.model.allAssets()
        this.push({ tag: 'assets', data: assets })
      }
    }

    if (resource === 'currents') {
      let records
      if (link) {
        const record = await this.sidecar.model.getCurrent(link)
        if (record === null) throw ERR_NOT_FOUND(link + ' not found', { link })
        records = [record]
      } else {
        records = await this.sidecar.model.allCurrents()
      }
      this.push({ tag: 'currents', data: records })
    }
  }
}
