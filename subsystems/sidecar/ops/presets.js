'use strict'
const { ERR_INVALID_LINK } = require('pear-errors')
const Opstream = require('../lib/opstream')
const plink = require('pear-link')

module.exports = class Presets extends Opstream {
  constructor(...args) {
    super((...args) => this.#op(...args), ...args)
  }

  async #op({ link, command, flags, reset = false }) {
    const { sidecar } = this
    await sidecar.ready()

    if (!link) throw ERR_INVALID_LINK('Link required')

    link = plink.normalize(link)

    if (flags) {
      const presets = await this.sidecar.model.setPresets(link, command, flags)
      this.final = { presets }
    } else {
      if (!reset) {
        const presets = await this.sidecar.model.getPresets(link, command)
        this.final = { presets }
      } else {
        await this.sidecar.model.resetPresets(link, command)
        this.final = { presets: null }
      }
    }
  }
}
