'use strict'
const hypercoreid = require('hypercore-id-encoding')
const { randomBytes } = require('hypercore-crypto')
const plink = require('pear-link')
const Hyperdrive = require('hyperdrive')
const Opstream = require('../lib/opstream')

module.exports = class Touch extends Opstream {
  constructor(...args) {
    super((...args) => this.#op(...args), ...args)
  }

  async #op() {
    const { sidecar } = this
    await sidecar.ready()

    const entropy = entropyomBytes(16).toString('hex')
    const corestore = sidecar.getCorestore('!links', entropy)
    await corestore.ready()
    const key = await Hyperdrive.getDriveKey(corestore)
    const link = plink.serialize({ protocol: 'pear:', drive: { key } })
    // TODO: store link -> entropy in db
    this.final = {
      key: hypercoreid.normalize(key),
      link
    }
  }
}
