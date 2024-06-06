'use strict'
const Opstream = require('../lib/opstream')
const Store = require('../lib/store')

module.exports = class EncryptionKey extends Opstream {
  constructor (params, client) {
    super((...args) => {
      if (params.action === 'add') return this.#add(...args)
      if (params.action === 'remove') return this.#remove(...args)
    }, params, client)
    this.store = new Store('encryption-keys')
  }

  async #add ({ name, secret }) {
    const result = await this.store.set(name, secret)
    this.push({ tag: 'added', data: { name } })
    return result
  }

  async #remove ({ name }) {
    const result = await this.store.set(name, undefined)
    this.push({ tag: 'removed', data: { name } })
    return result
  }
}
