'use strict'
const Opstream = require('../lib/opstream')
const plink = require('pear-link')

module.exports = class Presets extends Opstream {
  constructor(...args) {
    super((...args) => this.#op(...args), ...args)
  }

  async #op({ link, command, flags, reset = false }) {
    const { sidecar } = this
    await sidecar.ready()

    link = plink.normalize(link)

    if (flags) {
      const presets = await this.sidecar.model.setPresets(link, command, flags)
      this.push({ tag: 'presets', data: { presets } })
    } else {
      if (!reset) {
        const presets = await this.sidecar.model.getPresets(link, command)
        this.push({ tag: 'presets', data: { presets } })
      } else {
        await this.sidecar.model.resetPresets(link, command)
        this.push({ tag: 'presets', data: { presets: null } })
      }
    }
  }
}
