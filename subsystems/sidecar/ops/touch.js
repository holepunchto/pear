'use strict'
const hypercoreid = require('hypercore-id-encoding')
const Hyperdrive = require('hyperdrive')
const { ERR_INVALID_PROJECT_DIR } = require('pear-api/errors')
const Opstream = require('../lib/opstream')
const State = require('../state')

module.exports = class Touch extends Opstream {
  constructor (...args) { super((...args) => this.#op(...args), ...args) }

  async #op ({ dir, channel }) {
    const { sidecar } = this
    await sidecar.ready()
    const state = new State({ dir, flags: {} })
    if (!state.manifest) throw new ERR_INVALID_PROJECT_DIR(`"${state.pkgPath}" not found. Pear project must have a package.json`)
    const corestore = sidecar._getCorestore(state.manifest.name, channel)
    await corestore.ready()
    const key = await Hyperdrive.getDriveKey(corestore)
    this.push({ tag: 'result', data: { key: hypercoreid.normalize(key), channel } })
  }
}
