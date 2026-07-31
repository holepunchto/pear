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

    LOG.trace('gc cores', 'starting', { link })

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

    if (!metadataInfo) {
      LOG.trace('gc cores', 'metadata core not found', { link })
      this.final = { count }
      return
    }

    if (metadataInfo.auth && metadataInfo.auth.keyPair) {
      LOG.trace('gc cores', 'metadata core is writable, skipping', { link })
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

      LOG.trace('gc cores', 'resolved content core from manifest', {
        link,
        discoveryKey: hypercoreid.encode(contentDiscoveryKey)
      })
    } else {
      LOG.trace('gc cores', 'resolving content core through Hyperdrive', { link })

      const drive = new Hyperdrive(sidecar.getCorestore(), parsed.drive.key)
      try {
        await this.session.add(drive)
      } catch {
        await drive.close()
        throw ERR_NOT_FOUND(`Could not resolve blob core for "${link}"`)
      }
      if (!drive.blobs) throw ERR_NOT_FOUND(`Could not resolve blob core for "${link}"`)
      contentDiscoveryKey = drive.blobs.core.discoveryKey

      LOG.trace('gc cores', 'resolved content core from drive', {
        link,
        discoveryKey: hypercoreid.encode(contentDiscoveryKey)
      })

      await drive.close()
    }

    const coreInfos = [await sidecar.corestore.storage.getInfo(contentDiscoveryKey), metadataInfo]
    const dlink = plink.serialize({ drive: { key: parsed.drive.key } })
    for (const coreInfo of coreInfos) {
      if (!coreInfo) {
        LOG.trace('gc cores', 'core metadata missing, skipping')
        continue
      }

      if (coreInfo.auth && coreInfo.auth.keyPair) {
        LOG.trace('gc cores', 'skipping writable core', {
          discoveryKey: hypercoreid.encode(coreInfo.discoveryKey)
        })
        continue
      }

      const discoveryKey = hypercoreid.encode(coreInfo.discoveryKey)

      const core = await this.session.add(
        sidecar.corestore.get({
          discoveryKey: coreInfo.discoveryKey,
          active: false
        })
      )
      const coreLength = core.length

      LOG.info('gc cores', 'clearing core', {
        discoveryKey,
        link: dlink,
        coreLength
      })

      await core.clear(0, coreLength)
      this.push({
        tag: 'remove',
        data: {
          operation: 'clear',
          resource: resource,
          id: discoveryKey,
          link: dlink
        }
      })
      count++
      await core.close()
    }
    await sidecar.corestore.storage.compact()

    LOG.info('gc cores', 'completed', {
      link,
      removed: count
    })

    this.final = { count }
  }
}
