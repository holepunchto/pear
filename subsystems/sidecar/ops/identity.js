'use strict'
const hid = require('hypercore-id-encoding')
const { ERR_INVALID_INPUT } = require('pear-errors')
const Opstream = require('../lib/opstream')
const BlindPeer = require('blind-peer')

module.exports = class Identity extends Opstream {
  constructor(...args) {
    super((...args) => this.#op(...args), ...args)
  }

  async #op({ type = 'blind-peer-client' } = {}) {
    await this.sidecar.ready()

    const keyPairs = {
      seed: this.sidecar.keyPair,
      'blind-relay': this.sidecar.blindRelayKeyPair,
      'blind-peer-client': this.sidecar.dhtKeyPair
    }

    let publicKey = keyPairs[type]?.publicKey

    if (type === 'blind-peer') {
      let blindPeer = this.sidecar.activeBlindPeer
      if (blindPeer?.closing) await blindPeer.closing
      if (!blindPeer || blindPeer.closed) {
        blindPeer = await this.session.add(
          new BlindPeer(this.sidecar.blindPeerPath(), { bootstrap: this.sidecar.nodes })
        )
      }
      publicKey = blindPeer.publicKey
    }

    if (!publicKey) throw ERR_INVALID_INPUT('Unknown identity: ' + type)

    this.final = { publicKey: hid.normalize(publicKey) }
  }
}
