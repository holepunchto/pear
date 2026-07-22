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

    let openCount = 0

    for (const discoveryKey of discoveryKeys) {
      const dkey = hypercoreid.encode(discoveryKey)
      const info = await sidecar.corestore.storage.getInfo(discoveryKey)

      const open = Boolean(info.auth?.keyPair)
      if (open) {
        ++openCount
      }

      const key = info.auth?.key
      const dlink = key ? plink.serialize({ drive: { key } }) : null
      this.push({
        tag: 'core',
        data: {
          id: dkey,
          link: dlink,
          open
        }
      })
    }

    this.final = { count: discoveryKeys.length, open: openCount }
  }
}
