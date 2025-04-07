const Opstream = require('../lib/opstream')

module.exports = class Presets extends Opstream {
  constructor (...args) {
    super((...args) => this.#op(...args), ...args)
  }

  async #op ({ link, flags }) {
    if (flags) {
      const preset = JSON.stringify(flags)
      const record = await this.sidecar.model.updateAppPreset(link, preset)
      this.push({ tag: 'updated', data: JSON.parse(record.preset.run) })
    } else {
      try {
        const bundle = await this.sidecar.model.getBundle(link)
        if (bundle) {
          if (bundle.preset) {
            this.push({ tag: 'info', data: JSON.parse(bundle.preset.run) })
          } else {
            this.push({ tag: 'info', data: null })
          }
        } else {
          this.push({ tag: 'error', data: { message: `Pear app ${link} not found.` } })
        }
      } catch (err) {
        this.push({ tag: 'error', data: { message: err.message } })
      }
    }
  }
}
