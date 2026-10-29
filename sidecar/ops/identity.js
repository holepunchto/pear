'use strict'
const hid = require('hypercore-id-encoding')
const { ERR_INVALID_INPUT } = require('pear-errors')
const Opstream = require('../lib/opstream')
const BlindPeer = require('blind-peer')

module.exports = class Identity extends Opstream {
  constructor(...args) {
    super((...args) => this.#op(...args), ...args)
  }

  async #op({ type } = {}) {
    await this.sidecar.ready()
    if (type === 'seed') return this.seed()
    if (type === 'blind-relay') return this.blindRelay()
    if (type === 'blind-peer') return this.blindPeer()
    if (type === 'blind-peer-client') return this.blindPeerClient()
    throw ERR_INVALID_INPUT('Unknown identity: ' + type)
  }

  seed() {
    this.final = { publicKey: hid.normalize(this.sidecar.keyPair.publicKey) }
  }

  blindRelay() {
    this.final = { publicKey: hid.normalize(this.sidecar.blindRelayKeyPair.publicKey) }
  }

  async blindPeer() {
    let blindPeer = this.sidecar.activeBlindPeer
    if (blindPeer?.closing) await blindPeer.closing
    if (!blindPeer || blindPeer.closed) {
      blindPeer = await this.session.add(
        new BlindPeer(this.sidecar.blindPeerPath(), { bootstrap: this.sidecar.nodes })
      )
      this.sidecar.activeBlindPeer = blindPeer
      blindPeer.on('close', () => {
        if (this.sidecar.activeBlindPeer === blindPeer) this.sidecar.activeBlindPeer = null
      })
    }
    this.final = { publicKey: hid.normalize(blindPeer.publicKey) }
  }

  blindPeerClient() {
    this.final = { publicKey: hid.normalize(this.sidecar.dhtKeyPair.publicKey) }
  }
}
