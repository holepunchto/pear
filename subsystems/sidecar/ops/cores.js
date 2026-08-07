'use strict'
const Opstream = require('../lib/opstream')
const hypercoreid = require('hypercore-id-encoding')
const plink = require('pear-link')

module.exports = class Cores extends Opstream {
  constructor(...args) {
    super((...args) => this.#op(...args), ...args)
  }

  async #op(params) {
    LOG.info('cores', 'Enumerating cores')

    const allCores = params.allCores

    const { sidecar } = this

    const discoveryKeys = []
    for await (const dkey of sidecar.corestore.list()) discoveryKeys.push(dkey)

    let writableCount = 0
    let count = 0

    LOG.info('cores', `Found ${discoveryKeys.length} discovery keys`)

    for (const discoveryKey of discoveryKeys) {
      const dkey = hypercoreid.encode(discoveryKey)
      const info = await sidecar.corestore.storage.getInfo(discoveryKey)

      const key = info.auth.key
      const link = plink.serialize({ drive: { key } })

      const core = sidecar.corestore.get({
        discoveryKey: info.discoveryKey,
        active: false
      })
      await core.ready()
      const coreInfo = await core.info()
      if (!allCores && coreInfo.contiguousLength === 0) {
        LOG.trace('cores', `Skipping empty core ${link}`)
        continue
      }

      ++count

      const writable = Boolean(info.auth.keyPair)
      if (writable) {
        ++writableCount
      }

      this.push({
        tag: 'core',
        data: {
          link,
          writable,
          length: core.length
        }
      })
    }

    this.final = { count, writable: writableCount }
  }
}
