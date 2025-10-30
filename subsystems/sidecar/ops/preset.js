'use strict'
const Opstream = require('../lib/opstream')
const plink = require('pear-link')
const State = require('../state')

module.exports = class Preset extends Opstream {
  constructor(...args) {
    super((...args) => this.#op(...args), ...args)
  }

  async #op({ link, command, configuration, reset = false }) {
    const { sidecar } = this
    await sidecar.ready()

    link = plink.normalize(link)

    if (configuration) {
      let bundle = await this.sidecar.model.getBundle(link)
      if (!bundle) {
        await this.sidecar.model.addBundle(link, State.storageFromLink(link))
      }
      const updatedBundle = await this.sidecar.model.setPreset(
        link,
        command,
        configuration
      )
      const preset = updatedBundle.presets.find((p) => p.command === command)
      this.push({ tag: 'preset', data: { preset } })
    } else {
      if (!reset) {
        const bundle = await this.sidecar.model.getBundle(link)
        const preset = bundle?.presets
          ? command
            ? bundle.presets.find((p) => p.command === command) || null
            : bundle.presets || null
          : null
        this.push({ tag: 'preset', data: { preset } })
      } else {
        await this.sidecar.model.resetPreset(link, command)
        this.push({ tag: 'preset', data: { preset: null } })
      }
    }
  }
}
