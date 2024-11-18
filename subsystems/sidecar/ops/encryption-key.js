'use strict'
const hypercoreid = require('hypercore-id-encoding')
const { ERR_INVALID_INPUT } = require('../../../errors')
const Opstream = require('../lib/opstream')
const Store = require('../lib/store')
const { SALT } = require('pear-api/constants')
const deriveEncryptionKey = require('pw-to-ek')

module.exports = class EncryptionKey extends Opstream {
  constructor (params, client) {
    super((...args) => {
      if (params.action === 'add') return this.#add(...args)
      if (params.action === 'remove') return this.#remove(...args)
    }, params, client)
    this.store = new Store('encryption-keys')
  }

  async #add ({ name, value }) {
    try { hypercoreid.decode(value) } catch { throw ERR_INVALID_INPUT('Invalid encryption key') }
    const encryptionKey = await deriveEncryptionKey(value, SALT)
    const result = await this.store.set(name, encryptionKey.toString('hex'))
    this.push({ tag: 'added', data: { name } })
    return result
  }

  async #remove ({ name }) {
    const result = await this.store.set(name, undefined)
    this.push({ tag: 'removed', data: { name } })
    return result
  }
}
