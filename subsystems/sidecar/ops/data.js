'use strict'
const Opstream = require('../lib/opstream')

module.exports = class Data extends Opstream {
  constructor(...args) {
    super((...args) => this.#op(...args), ...args)
  }

  async #op({ resource }) {
    await this.sidecar.ready()

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
