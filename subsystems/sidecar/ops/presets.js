'use strict'
const plink = require('pear-link')
const Opstream = require('../lib/opstream')

module.exports = class Presets extends Opstream {
  constructor(...args) {
    super((...args) => this.#op(...args), ...args)
  }

  async #op({ link, command, configuration }) {
    await this.sidecar.ready()
    link = plink.normalize(link)

    if (configuration) {
      let bundle = await this.sidecar.model.getBundle(link)
      if (!bundle) {
        await this.model.addBundle(link, State.storageFromLink(link))
      }
      const updatedBundle = await this.sidecar.model.setPreset(
        link,
        command,
        configuration
      )
      this.push({
        tag: 'preset',
        data: updatedBundle
      })
    } else {
      const bundle = await this.sidecar.model.getBundle(link)
      this.push({
        tag: 'preset',
        data: bundle.presets
          ? bundle.presets.find((p) => p.command === command)
          : null
      })
    }
  }
}
