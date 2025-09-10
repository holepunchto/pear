'use strict'
const Opstream = require('../lib/opstream')

module.exports = class Build extends Opstream {
  constructor (...args) {
    super((...args) => this.#op(...args), ...args)
  }

  async #op ({ link, dir } = {}) {
    this.push({ tag: 'building', data: { link, dir } })
  }
}
