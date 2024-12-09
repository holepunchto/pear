'use strict'
const hypercoreid = require('hypercore-id-encoding')
const { ERR_INVALID_INPUT } = require('../../../errors')
const Opstream = require('../lib/opstream')
const { SALT } = require('../../../constants')
const deriveEncryptionKey = require('pw-to-ek')

module.exports = class EncryptionKey extends Opstream {
  constructor (params, client, sidecar) {
    super((...args) => {
      if (params.action === 'add') return this.#add(...args)
      if (params.action === 'remove') return this.#remove(...args)
    }, params, client, sidecar)
  }

  async #add ({ name, value }) {
    try { hypercoreid.decode(value) } catch { throw ERR_INVALID_INPUT('Invalid encryption key') }
    const encryptionKey = await deriveEncryptionKey(value, SALT).toString('hex')
    this.sidecar.db.insert('@pear/bundle', { link: name, encryptionKey })
    this.push({ tag: 'added', data: { name } })
    return true
  }

  async #remove ({ name }) {
    await this.sidecar.db.delete('@pear/bundle', { link: name })
    this.push({ tag: 'removed', data: { name } })
    return true
  }
}
