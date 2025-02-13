'use strict'

const Opstream = require('../../lib/opstream')

module.exports = class DataReset extends Opstream {
  constructor (...args) {
    super((...args) => this.#op(...args), ...args)
  }

  async #op () {
    await this.sidecar.model.reset()
    this.push({ tag: 'complete' })
  }
}
