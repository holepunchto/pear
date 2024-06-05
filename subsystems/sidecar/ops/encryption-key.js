'use strict'
const hypercoreid = require('hypercore-id-encoding')
const { randomBytes } = require('hypercore-crypto')
const Bundle = require('../lib/bundle')
const Opstream = require('../lib/opstream')
const State = require('../state')
const { ERR_UNSTAGED, ERR_INVALID_CONFIG } = require('../../../errors')

module.exports = class EncryptionKey extends Opstream {
  constructor (params, client) {
    super((...args) => {
      if (params.action === 'add') this.#add(...args)
    }, ...args)
  }

  async #op ({ name, secret }) {

  }
}
