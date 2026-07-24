'use strict'
const { ERR_INVALID_GC_RESOURCE, ERR_INVALID_INPUT, ERR_NOT_FOUND } = require('pear-errors')
const Opstream = require('../lib/opstream')
const hypercoreid = require('hypercore-id-encoding')
const Hyperdrive = require('hyperdrive')
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

    let count = 0
    const metadataDiscoveryKey = crypto.discoveryKey(parsed.drive.key)
    const metadataInfo = await sidecar.corestore.storage.getInfo(metadataDiscoveryKey)
    if (!metadataInfo || (metadataInfo.auth && metadataInfo.auth.keyPair)) {
      this.final = { count }
      return
    }

    let contentDiscoveryKey = null
    const contentKey =
      metadataInfo.auth && metadataInfo.auth.manifest
        ? Hyperdrive.getContentKey(metadataInfo.auth.manifest, parsed.drive.key)
        : null

    if (contentKey) {
      contentDiscoveryKey = crypto.discoveryKey(contentKey)
    } else {
      const drive = new Hyperdrive(sidecar.getCorestore(), parsed.drive.key)
      try {
        await this.session.add(drive)
      } catch {
        await drive.close()
        throw ERR_NOT_FOUND(`Could not resolve blob core for "${link}"`)
      }
      if (!drive.blobs) throw ERR_NOT_FOUND(`Could not resolve blob core for "${link}"`)
      contentDiscoveryKey = drive.blobs.core.discoveryKey
      await drive.close()
    }

    const coreInfos = [await sidecar.corestore.storage.getInfo(contentDiscoveryKey), metadataInfo]
    const dlink = plink.serialize({ drive: { key: parsed.drive.key } })
    for (const coreInfo of coreInfos) {
      if (!coreInfo || (coreInfo.auth && coreInfo.auth.keyPair)) continue

      const core = await this.session.add(
        sidecar.corestore.get({
          discoveryKey: coreInfo.discoveryKey,
          active: false
        })
      )
      await core.clear(0, core.length)
      this.push({
        tag: 'remove',
        data: {
          operation: 'clear',
          resource: resource,
          id: hypercoreid.encode(coreInfo.discoveryKey),
          link: dlink
        }
      })
      count++
      await core.close()
    }
    await sidecar.corestore.storage.compact()
    this.final = { count }
  }
}
