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
      this.final = { data }
    }

    if (resource === 'dht') {
      const nodes = await this.sidecar.model.getDhtNodes()
      this.final = { nodes }
    }

    if (resource === 'gc') {
      const records = await this.sidecar.model.allGc()
      this.final = { records }
    }

    if (resource === 'manifest') {
      const manifest = await this.sidecar.model.getManifest()
      this.final = { manifest }
    }

    if (resource === 'assets') {
      await this.sidecar.model.allocatedAssets()
      if (link) {
        const asset = await this.sidecar.model.getAsset(link)
        if (asset === null) throw ERR_NOT_FOUND(link + ' not found', { link })
        this.final = { assets: [asset] }
      } else {
        const assets = await this.sidecar.model.allAssets()
        this.final = { assets: assets }
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
      this.final = { records }
    }
  }
}
