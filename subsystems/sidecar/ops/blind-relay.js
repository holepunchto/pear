'use strict'
const Opstream = require('../lib/opstream')
const ReadyResource = require('ready-resource')
const RelayServer = require('blind-relay').Server
const hypercoreid = require('hypercore-id-encoding')
const { ERR_INVALID_INPUT, ERR_OPERATION_FAILED } = require('pear-errors')

class BlindRelayServer extends ReadyResource {
  constructor({ dht, blindRelayKeyPair }) {
    super()
    this.dht = dht
    this.blindRelayKeyPair = blindRelayKeyPair
  }

  async _open() {
    LOG.trace('blind-relay', 'starting')

    this.relay = new RelayServer({
      createStream(opts) {
        LOG.trace('blind-relay', 'creating raw stream')
        return this.dht.createRawStream({ ...opts, framed: true })
      }
    })

    this.server = this.dht.createServer((socket) => {
      LOG.trace('blind-relay', 'connection accepted', {
        remotePublicKey: hypercoreid.encode(socket.remotePublicKey)
      })

      return this.relay.accept(socket, {
        id: socket.remotePublicKey
      })
    })

    await this.server.listen(this.blindRelayKeyPair)
  }

  async _close() {
    LOG.trace('blind-relay', 'stopping')
    await this.server.close()
    LOG.trace('blind-relay', 'server closed')
    await this.relay.close()
    LOG.trace('blind-relay', 'relay closed')
  }
}

module.exports = class BlindRelay extends Opstream {
  constructor(...args) {
    super((...args) => this.#op(...args), ...args)
  }

  async #op(params) {
    await this.sidecar.ready()
    if (params.action === 'start') return this.start(params)
    throw ERR_INVALID_INPUT('Invalid action to blind-relay: ' + params.action)
  }

  async start({ statsInterval = 500 } = {}) {
    LOG.trace('blind-relay start', 'starting', { statsInterval })

    const { sidecar, session } = this

    if (sidecar.activeBlindRelay) {
      if (sidecar.activeBlindRelay.closing) await sidecar.activeBlindRelay.closing
      if (sidecar.activeBlindRelay?.closed) sidecar.activeBlindRelay = null
      if (sidecar.activeBlindRelay) {
        throw new ERR_OPERATION_FAILED('Blind relay is already running, cannot start another')
      }
    }

    const blindRelayServer = await session.add(
      new BlindRelayServer({
        dht: sidecar.dht,
        blindRelayKeyPair: sidecar.blindRelayKeyPair
      })
    )
    sidecar.activeBlindRelay = blindRelayServer
    blindRelayServer.on('close', () => {
      if (sidecar.activeBlindRelay === blindRelayServer) sidecar.activeBlindRelay = null
    })

    this.push({
      tag: 'listening',
      data: { publicKey: hypercoreid.encode(blindRelayServer.server.publicKey) }
    })

    this._statsInterval = setInterval(() => {
      this.push({ tag: 'stats', data: { stats: blindRelayServer.relay.stats } })
    }, statsInterval)
    session.teardown(() => {
      LOG.trace('blind-relay start', 'teardown')
      clearInterval(this._statsInterval)
    })

    await new Promise((resolve) => session.teardown(resolve))
  }
}
