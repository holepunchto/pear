const Opstream = require('../lib/opstream')

module.exports = class Presets extends Opstream {
  constructor (...args) {
    super((...args) => this.#op(...args), ...args)
  }

  async #op ({ link, flags }) {
    const preset = JSON.stringify(flags)
    const record = await this.sidecar.model.updateAppPreset(link, preset)
    this.push({ tag: 'updated', data: JSON.parse(record.preset.run) })
  }
}
