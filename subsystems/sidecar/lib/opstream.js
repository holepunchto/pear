'use strict'
const Session = require('./session')
module.exports = class Opstream extends require('pear-opstream') {
  constructor(op, params, client, sidecar = null, { autosession = true } = {}) {
    super(op, params, () => {
      if (autosession) return this.session.close()
    })
    this.session = autosession ? new Session(client) : null
    this.client = client
    this.sidecar = sidecar
  }
}
