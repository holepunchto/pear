'use strict'
const hypercoreid = require('hypercore-id-encoding')
const Hyperdrive = require('hyperdrive')
const Opstream = require('../lib/opstream')
const State = require('../state')

module.exports = class Touch extends Opstream {
  constructor (...args) { super((...args) => this.#op(...args), ...args) }

  async #op ({ dir, channel }) {
    const { sidecar } = this
    await sidecar.ready()
    const def = await State.localDef({ dir })
    const corestore = sidecar._getCorestore(State.name(def), channel)
    await corestore.ready()
    const key = await Hyperdrive.getDriveKey(corestore)
    this.push({ tag: 'result', data: { key: hypercoreid.normalize(key), channel } })
  }
}
