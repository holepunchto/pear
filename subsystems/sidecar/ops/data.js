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
      if (!secrets) {
        data = data.map(({ encryptionKey, checkout, current, appStorage, ...rest }) => rest)
      }
      this.final = { data }
    }

    if (resource === 'dht') {
      const nodes = this.sidecar.swarm.dht.toArray()
      this.final = { nodes }
    }

    if (resource === 'multisig') {
      const records = await this.sidecar.db.model.allMultisig()
      this.final = { records }
    }

    if (resource === 'gc') {
      const records = await this.sidecar.model.allGc()
      this.final = { records }
    }
  }
}
