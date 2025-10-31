'use strict'
const Opstream = require('../lib/opstream')
const plink = require('pear-link')
const State = require('../state')

module.exports = class Preset extends Opstream {
  constructor(...args) {
    super((...args) => this.#op(...args), ...args)
  }

  async #op({ link, command, flags, reset = false }) {
    const { sidecar } = this
    await sidecar.ready()

    link = plink.normalize(link)

    if (flags) {
      const preset = await this.sidecar.model.setPreset(link, command, flags)
      this.push({ tag: 'preset', data: { preset } })
    } else {
      if (!reset) {
        const preset = await this.sidecar.model.getPreset(link, command)
        this.push({ tag: 'preset', data: { preset } })
      } else {
        await this.sidecar.model.resetPreset(link, command)
        this.push({ tag: 'preset', data: { preset: null } })
      }
    }
  }
}
