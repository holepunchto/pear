'use strict'
const { ERR_INVALID_GC_RESOURCE, ERR_INVALID_INPUT } = require('pear-errors')
const Opstream = require('../lib/opstream')
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
    const { data = {} } = params
    const { link } = data

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

    const cleared = await this._clearCore(link)

    if (cleared) {
      this.push({
        tag: 'cores',
        data: {
          skipped: false,
          link
        }
      })
    } else {
      this.push({
        tag: 'cores',
        data: {
          skipped: true,
          link
        }
      })
    }

    LOG.info('gc cores', 'completed', {
      link
    })
  }

  async _clearCore(link) {
    const key = plink.parse(link).drive.key
    const discoveryKey = crypto.discoveryKey(key)
    const info = await this.sidecar.corestore.storage.getInfo(discoveryKey)

    if (!info) {
      LOG.trace('gc cores', 'core not found', { link })
      return false
    }

    if (info.auth.keyPair) {
      LOG.trace('gc cores', 'core is writable, skipping', { link })
      return false
    }

    const core = this.sidecar.corestore.get({
      discoveryKey: info.discoveryKey,
      active: false
    })
    await core.ready()
    const coreLength = core.length

    LOG.info('gc cores', 'clearing core', {
      discoveryKey,
      link,
      coreLength
    })

    await core.clear(0, coreLength)
    await core.close()

    return true
  }
}
