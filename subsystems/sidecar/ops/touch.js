'use strict'
const hypercoreid = require('hypercore-id-encoding')
const { randomBytes } = require('hypercore-crypto')
const Opstream = require('../lib/opstream')

module.exports = class Touch extends Opstream {
  constructor(...args) {
    super((...args) => this.#op(...args), ...args)
  }

  async #op() {
    const { sidecar } = this
    await sidecar.ready()

    const corestore = sidecar.getCorestore()
    await corestore.ready()
    const keyPair = await corestore.createKeyPair(randomBytes(16).toString('hex'))
    const core = corestore.get({ keyPair, exclusive: true })
    await core.ready()
    const key = core.key
    await core.close()
    const normalized = hypercoreid.normalize(key)
    this.final = {
      key: normalized,
      link: 'pear://' + normalized
    }
  }
}
