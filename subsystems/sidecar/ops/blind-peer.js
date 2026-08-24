'use strict'
const path = require('bare-path')
const hid = require('hypercore-id-encoding')
const safetyCatch = require('safety-catch')
const { ERR_INVALID_INPUT, ERR_OPERATION_FAILED } = require('pear-errors')
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
    if (subcommand === 'identity') return this.identity()
    if (subcommand === 'request') return this.request(data)
    throw ERR_INVALID_INPUT('Unknown subcommand: ' + subcommand)
  }

  async identity() {
    this.final = {
      publicKey: hid.normalize(this.sidecar.dhtKeypair.publicKey)
    }
  }

  async start({ trustedPeer } = {}) {
    const { sidecar, session } = this

    if (sidecar.activeBlindPeer) {
      if (sidecar.activeBlindPeer.closing) await sidecar.activeBlindPeer.closing
      else throw new ERR_OPERATION_FAILED('Blind peer is already running, cannot start another')
    }

    const storagePath = path.join(
      path.dirname(path.dirname(sidecar.corestore.storage.path)),
      'blind-peer'
    )

    const blindPeer = await session.add(
      new BlindPeer(storagePath, {
        bootstrap: sidecar.nodes,
        trustedPubKeys: trustedPeer ? [hid.decode(trustedPeer)] : []
      })
    )
    sidecar.activeBlindPeer = blindPeer

    blindPeer.on('flush-error', (err) => LOG.error('blind-peer', 'Flush error', err))
    blindPeer.on('muxer-error', (err, stream) => {
      LOG.error('blind-peer', 'Muxer error from ' + hid.normalize(stream.remotePublicKey), err)
    })
    blindPeer.on('add-new-core', (record) => {
      this.push({ tag: 'add-core', data: { announce: record.announce } })
    })
    blindPeer.on('delete-blocked', (stream, { key }) => {
      this.push({
        tag: 'delete-blocked',
        data: {
          key: hid.normalize(key),
          peerKey: hid.normalize(stream.remotePublicKey)
        }
      })
    })
    blindPeer.on('delete-core', (stream, { key }) => {
      this.push({
        tag: 'delete-core',
        data: { key: hid.normalize(key), peerKey: hid.normalize(stream.remotePublicKey) }
      })
    })
    blindPeer.on('delete-core-end', (stream, { key }) => {
      this.push({ tag: 'delete-core-end', data: { key: hid.normalize(key) } })
    })
    blindPeer.on('downgrade-announce', ({ record, remotePublicKey }) => {
      this.push({
        tag: 'downgrade-announce',
        data: { record, peerKey: hid.normalize(remotePublicKey) }
      })
    })
    blindPeer.on('add-cores-downgrade-announce', ({ remotePublicKey }) => {
      this.push({
        tag: 'add-cores-downgrade-announce',
        data: { peerKey: hid.normalize(remotePublicKey) }
      })
    })
    blindPeer.on('announce-core', (core) => {
      this.push({ tag: 'announce-core', data: { key: hid.normalize(core.key) } })
    })
    blindPeer.on('announced-initial-cores', () => {
      this.push({ tag: 'announced-initial-cores', data: {} })
    })
    blindPeer.on('core-downloaded', (core) => {
      this.push({ tag: 'core-downloaded', data: { key: hid.normalize(core.key) } })
    })
    blindPeer.on('core-append', (core) => {
      this.push({ tag: 'core-append', data: { key: hid.normalize(core.key), length: core.length } })
    })
    blindPeer.on('core-client-mode-changed', (core, isClient) => {
      this.push({
        tag: 'core-client-mode-changed',
        data: { key: hid.normalize(core.key), isClient }
      })
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
        publicKey: hid.normalize(blindPeer.publicKey),
        encryptionPublicKey: hid.normalize(blindPeer.encryptionPublicKey)
      }
    })

    await new Promise((resolve) => session.teardown(resolve))
  }

  async request({ key, peerKey, announce = true } = {}) {
    const { sidecar, session } = this

    if (!key) throw ERR_INVALID_INPUT('A core key must be specified')
    if (!peerKey) throw ERR_INVALID_INPUT('A blind peer key must be specified')

    const coreKey = hid.decode(key)
    const blindPeerKey = hid.decode(peerKey)

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
    // TODO: Also add blobs core

    this.push({
      tag: 'seeding',
      data: {
        key: hid.normalize(coreKey),
        peerKey: hid.normalize(blindPeerKey),
        announce: result[0].announce
      }
    })
  }
}
