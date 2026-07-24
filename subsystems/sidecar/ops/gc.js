'use strict'
const { ERR_INVALID_GC_RESOURCE, ERR_INVALID_INPUT } = require('pear-errors')
const Opstream = require('../lib/opstream')
const hypercoreid = require('hypercore-id-encoding')
const crypto = require('hypercore-crypto')
const plink = require('pear-link')

module.exports = class GC extends Opstream {
  constructor(...args) {
    super((...args) => this.#op(...args), ...args)
  }

  #op(params) {
    if (params.resource === 'cores') return this.cores(params)
    throw ERR_INVALID_GC_RESOURCE('Invalid resource to gc: ' + params.resource)
  }

  async cores(params) {
    const { resource, data = {} } = params
    const { link } = data
    const { sidecar } = this

    if (!link) throw ERR_INVALID_INPUT('A link must be specified')

    let parsed = null
    try {
      parsed = plink.parse(link)
    } catch {
      throw ERR_INVALID_INPUT(`Link "${link}" is not a valid key`)
    }
    if (parsed.drive.key === null) {
      throw ERR_INVALID_INPUT(`Link "${link}" is not a valid key`)
    }

    const metadataDiscoveryKey = crypto.discoveryKey(parsed.drive.key)
    const metadataInfo = await sidecar.corestore.storage.getInfo(metadataDiscoveryKey)
    if (!metadataInfo) return

    const discoveryKeys = []
    for await (const dkey of sidecar.corestore.list()) discoveryKeys.push(dkey)
    for (const discoveryKey of discoveryKeys) {
      const dkey = hypercoreid.encode(discoveryKey)
      const info = await sidecar.corestore.storage.getInfo(discoveryKey)
      if (info.auth && info.auth.keyPair) continue

      const core = sidecar.corestore.get({
        discoveryKey: info.discoveryKey,
        active: false
      })
      await core.ready()
      await core.clear(0, core.length)
      const dlink =
        info.auth && info.auth.key ? plink.serialize({ drive: { key: info.auth.key } }) : null
      this.push({
        tag: 'remove',
        data: {
          operation: 'clear',
          resource: resource,
          id: dkey,
          link: dlink
        }
      })
      await core.close()
    }
    await sidecar.corestore.storage.compact()
  }
}
