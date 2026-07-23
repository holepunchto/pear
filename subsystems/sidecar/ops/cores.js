'use strict'
const Opstream = require('../lib/opstream')
const hypercoreid = require('hypercore-id-encoding')
const plink = require('pear-link')

module.exports = class Cores extends Opstream {
  constructor(...args) {
    super((...args) => this.#op(...args), ...args)
  }

  async #op(params) {
    const { sidecar } = this

    const discoveryKeys = []
    for await (const dkey of sidecar.corestore.list()) discoveryKeys.push(dkey)

    let writableCount = 0

    for (const discoveryKey of discoveryKeys) {
      const dkey = hypercoreid.encode(discoveryKey)
      const info = await sidecar.corestore.storage.getInfo(discoveryKey)

      const writable = Boolean(info.auth.keyPair)
      if (writable) {
        ++writableCount
      }

      const key = info.auth.key
      const link = plink.serialize({ drive: { key } })
      this.push({
        tag: 'core',
        data: {
          link,
          writable
        }
      })
    }

    this.final = { count: discoveryKeys.length, writable: writableCount }
  }
}
