'use strict'
const path = require('bare-path')
const hypercoreid = require('hypercore-id-encoding')
const safetyCatch = require('safety-catch')
const { ERR_INVALID_INPUT } = require('pear-errors')
const Opstream = require('../lib/opstream')
const BlindPeer = require('blind-peer')
const BlindPeering = require('blind-peering')

module.exports = class BlindPeerOp extends Opstream {
  constructor(...args) {
    super((...args) => this.#op(...args), ...args)
  }

  async #op({ subcommand, data } = {}) {
    await this.sidecar.ready()
    if (subcommand === 'start') return this.start(data)
    if (subcommand === 'request') return this.request(data)
    throw ERR_INVALID_INPUT('Unknown subcommand: ' + subcommand)
  }

  async start({ trustedPeer } = {}) {
    const { sidecar, session } = this

    const storagePath = path.join(
      path.dirname(path.dirname(sidecar.corestore.storage.path)),
      'blind-peer'
    )

    const blindPeer = await session.add(
      new BlindPeer(storagePath, {
        bootstrap: sidecar.nodes,
        swarm: sidecar.swarm,
        trustedPubKeys: trustedPeer ? [hypercoreid.decode(trustedPeer)] : []
      })
    )

    blindPeer.on('flush-error', (err) => LOG.error('blind-peer', 'Flush error', err))
    blindPeer.on('muxer-error', (err, stream) => {
      LOG.error(
        'blind-peer',
        'Muxer error from ' + hypercoreid.normalize(stream.remotePublicKey),
        err
      )
    })
    blindPeer.on('add-new-core', (record) => {
      this.push({ tag: 'add-core', data: { announce: record.announce } })
    })
    blindPeer.on('announce-core', (core) => {
      this.push({ tag: 'announce-core', data: { key: hypercoreid.normalize(core.key) } })
    })
    blindPeer.on('gc-start', ({ bytesToClear }) => {
      this.push({ tag: 'gc-start', data: { bytesToClear } })
    })
    blindPeer.on('gc-done', ({ bytesCleared }) => {
      this.push({ tag: 'gc-done', data: { bytesCleared } })
    })

    await blindPeer.listen()

    this.push({
      tag: 'listening',
      data: {
        publicKey: hypercoreid.normalize(blindPeer.publicKey),
        encryptionPublicKey: hypercoreid.normalize(blindPeer.encryptionPublicKey)
      }
    })

    await new Promise((resolve) => session.teardown(resolve))
  }

  async request({ key, peerKey, announce = true } = {}) {
    const { sidecar, session } = this

    console.log('identity', hypercoreid.normalize(sidecar.keyPair.publicKey))
    this.push({
      tag: 'identity',
      data: { publicKey: hypercoreid.normalize(sidecar.keyPair.publicKey) }
    })

    if (!key) throw ERR_INVALID_INPUT('A core key must be specified')
    if (!peerKey) throw ERR_INVALID_INPUT('A blind peer key must be specified')

    const coreKey = hypercoreid.decode(key)
    const blindPeerKey = hypercoreid.normalize(peerKey)

    const corestore = sidecar.getCorestore()
    await corestore.ready()

    const core = corestore.get({ key: coreKey })
    await core.ready()

    const client = new BlindPeering(sidecar.swarm, corestore, {
      coreMirrors: [blindPeerKey],
      pick: 1
    })
    session.teardown(() => client.close().catch(safetyCatch))

    const result = await client.addCore(core.session(), blindPeerKey, { announce })
    // TODO: Request drive core and blob core

    this.push({
      tag: 'seeding',
      data: {
        key: hypercoreid.normalize(coreKey),
        peerKey: hypercoreid.normalize(blindPeerKey),
        announce: result ? result.announce : false
      }
    })
  }
}
