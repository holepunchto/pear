'use strict'
const DHT = require('hyperdht')
const Opstream = require('../lib/opstream')
const ReadyResource = require('ready-resource')
const RelayServer = require('blind-relay').Server
const hypercoreid = require('hypercore-id-encoding')
const { ERR_INVALID_INPUT } = require('pear-errors')

class BlindRelayServer extends ReadyResource {
  constructor(keyPair) {
    super()
    this.keyPair = keyPair
  }

  async _open() {
    LOG.trace('blind-relay', 'starting')

    this.dht = new DHT()
    LOG.trace('blind-relay', 'DHT created')

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

    await this.server.listen(this.keyPair)
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

  #op(params) {
    if (params.action === 'start') return this.start(params)
    throw ERR_INVALID_INPUT('Invalid action to blind-relay: ' + params.action)
  }

  async start({ statsInterval = 500 } = {}) {
    LOG.trace('blind-relay start', 'starting', { statsInterval })

    await this.sidecar.ready() // needed for keyPair generation

    const blindRelayServer = await this.session.add(new BlindRelayServer(this.sidecar.keyPair))

    this.push({
      tag: 'listening',
      data: { publicKey: hypercoreid.encode(blindRelayServer.server.publicKey) }
    })

    this._statsInterval = setInterval(() => {
      this.push({ tag: 'stats', data: { stats: blindRelayServer.relay.stats } })
    }, statsInterval)
    this.session.teardown(() => {
      LOG.trace('blind-relay start', 'teardown')
      clearInterval(this._statsInterval)
    })

    await new Promise((resolve) => this.session.teardown(resolve))
  }
}
