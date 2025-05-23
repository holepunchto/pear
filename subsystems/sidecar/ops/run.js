'use strict'
const Opstream = require('../lib/opstream')

module.exports = class Run extends Opstream {
  constructor (...args) { super((...args) => this.#op(...args), ...args, { sessionless: true }) }

  async #op (params) {
    this.final = await this.sidecar.start(params, this.client)
  }
}
