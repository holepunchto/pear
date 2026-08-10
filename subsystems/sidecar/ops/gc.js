'use strict'
const { ERR_INVALID_GC_RESOURCE, ERR_INVALID_INPUT } = require('pear-errors')
const Opstream = require('../lib/opstream')
const { parse } = require('../../../lib/link')
const crypto = require('hypercore-crypto')
const plink = require('pear-link')
const Hyperdrive = require('hyperdrive')

module.exports = class GC extends Opstream {
  constructor(...args) {
    super((...args) => this.#op(...args), ...args)
  }

  #op(params) {
    if (params.resource === 'cores') return this.cores(params)
    throw ERR_INVALID_GC_RESOURCE('Invalid resource to gc: ' + params.resource)
  }

  async cores(params) {
    const { data = {} } = params
    const { link } = data

    if (!link) throw ERR_INVALID_INPUT('A link must be specified')

    LOG.trace('gc cores', 'starting', { link })

    parse(link)

    const contentKey = await this._getContentKey(link)
    const cleared = await this._clearCore(link)

    if (!cleared) {
      this.push({
        tag: 'cores',
        data: {
          skipped: true,
          link
        }
      })
    } else {
      const contentCleared = await this._clearCore(contentKey)
      this.push({
        tag: 'cores',
        data: {
          skipped: false,
          link,
          content: contentCleared ? plink.serialize(contentKey) : null
        }
      })
    }

    LOG.info('gc cores', 'completed', {
      link
    })
  }

  async _clearCore(link) {
    const info = await this._getInfo(link)

    if (!info) {
      LOG.trace('gc cores', 'core not found', { link })
      return false
    }

    if (info.auth.keyPair) {
      LOG.trace('gc cores', 'core is writable, skipping', { link })
      return false
    }

    const core = this._getCore(info)
    try {
      await core.ready()
      const coreLength = core.length

      LOG.info('gc cores', 'clearing core', {
        link,
        coreLength
      })

      await core.clear(0, coreLength)
      return true
    } finally {
      await core.close()
    }
  }

  async _getContentKey(link) {
    const info = await this._getInfo(link)
    if (!info) return null

    const key = parse(link).drive.key
    return plink.serialize(Hyperdrive.getContentKey(info.auth.manifest, key))
  }

  _getInfo(link) {
    const key = parse(link).drive.key
    const discoveryKey = crypto.discoveryKey(key)
    return this.sidecar.corestore.storage.getInfo(discoveryKey)
  }

  _getCore(info) {
    return this.sidecar.corestore.get({
      discoveryKey: info.discoveryKey,
      active: false
    })
  }
}
