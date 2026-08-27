'use strict'
const path = require('bare-path')
const hid = require('hypercore-id-encoding')
const safetyCatch = require('safety-catch')
const { ERR_INVALID_INPUT, ERR_OPERATION_FAILED } = require('pear-errors')
const Opstream = require('../lib/opstream')
const BlindPeer = require('blind-peer')
const BlindPeering = require('blind-peering')
const Hyperdrive = require('hyperdrive')

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

  identity() {
    this.final = {
      publicKey: hid.normalize(this.sidecar.dhtKeypair.publicKey)
    }
  }

  async start({ trustedPeers = [] } = {}) {
    const { sidecar, session } = this

    if (sidecar.activeBlindPeer) {
      if (sidecar.activeBlindPeer.closing) await sidecar.activeBlindPeer.closing
      if (sidecar.activeBlindPeer?.closed) sidecar.activeBlindPeer = null
      if (sidecar.activeBlindPeer) {
        throw new ERR_OPERATION_FAILED('Blind peer is already running, cannot start another')
      }
    }

    const storagePath = path.join(
      path.dirname(path.dirname(sidecar.corestore.storage.path)),
      'blind-peer'
    )

    const blindPeer = await session.add(
      new BlindPeer(storagePath, {
        bootstrap: sidecar.nodes,
        trustedPubKeys: trustedPeers.map((peer) => hid.decode(peer))
      })
    )
    sidecar.activeBlindPeer = blindPeer
    blindPeer.on('close', () => {
      if (sidecar.activeBlindPeer === blindPeer) sidecar.activeBlindPeer = null
    })

    blindPeer.on('flush-error', (err) => LOG.error('blind-peer', 'Flush error', err))
    blindPeer.on('muxer-error', (err, stream) => {
      LOG.error('blind-peer', 'Muxer error from ' + hid.normalize(stream.remotePublicKey), err)
    })
    blindPeer.on('add-new-core', (record, _, stream) => {
      const data = {
        announce: record.announce,
        key: hid.normalize(record.key),
        peerKey: hid.normalize(stream.remotePublicKey)
      }
      LOG.info(
        'blind-peer',
        `Received add core request for ${data.key} from peer ${data.peerKey} (announce: ${data.announce})`
      )
      this.push({ tag: 'add-core', data })
    })
    blindPeer.on('delete-blocked', (stream, { key }) => {
      const data = { key: hid.normalize(key), peerKey: hid.normalize(stream.remotePublicKey) }
      LOG.info(
        'blind-peer',
        `Blocked delete request from untrusted peer ${data.peerKey} for core ${data.key}`
      )
      this.push({ tag: 'delete-blocked', data })
    })
    blindPeer.on('delete-core', (stream, { key }) => {
      const data = { key: hid.normalize(key), peerKey: hid.normalize(stream.remotePublicKey) }
      LOG.info('blind-peer', `Received delete request from ${data.peerKey} for core ${data.key}`)
      this.push({ tag: 'delete-core', data })
    })
    blindPeer.on('delete-core-end', (stream, { key }) => {
      const data = { key: hid.normalize(key) }
      LOG.info('blind-peer', `Deleted core ${data.key}`)
      this.push({ tag: 'delete-core-end', data })
    })
    blindPeer.on('downgrade-announce', ({ record, remotePublicKey }) => {
      const data = { record, peerKey: hid.normalize(remotePublicKey) }
      LOG.info(
        'blind-peer',
        `Downgraded announce for peer ${data.peerKey} because peer is not trusted`
      )
      this.push({ tag: 'downgrade-announce', data })
    })
    blindPeer.on('add-cores-downgrade-announce', ({ remotePublicKey }) => {
      const data = { peerKey: hid.normalize(remotePublicKey) }
      LOG.info(
        'blind-peer',
        `Downgraded announce for peer ${data.peerKey} because peer is not trusted`
      )
      this.push({ tag: 'add-cores-downgrade-announce', data })
    })
    blindPeer.on('announce-core', (core) => {
      const data = { key: hid.normalize(core.key) }
      LOG.info('blind-peer', `Announcing core: ${data.key}`)
      this.push({ tag: 'announce-core', data })
    })
    blindPeer.on('announced-initial-cores', () => {
      LOG.info('blind-peer', 'Announced all initial cores')
      this.push({ tag: 'announced-initial-cores', data: {} })
    })
    blindPeer.on('core-downloaded', (core) => {
      const data = { key: hid.normalize(core.key) }
      LOG.info('blind-peer', `Core fully downloaded: ${data.key}`)
      this.push({ tag: 'core-downloaded', data })
    })
    blindPeer.on('core-append', (core) => {
      const data = { key: hid.normalize(core.key), length: core.length }
      LOG.info('blind-peer', `Core length updated: ${data.key} (length: ${data.length})`)
      this.push({ tag: 'core-append', data })
    })
    blindPeer.on('core-client-mode-changed', (core, isClient) => {
      const data = { key: hid.normalize(core.key), isClient }
      LOG.info(
        'blind-peer',
        `Announced core ${isClient ? 'enabled' : 'disabled'} client mode: ${data.key}`
      )
      this.push({ tag: 'core-client-mode-changed', data })
    })
    blindPeer.on('gc-start', ({ bytesToClear }) => {
      const data = { bytesToClear }
      LOG.info('blind-peer', `GC started, clearing ${data.bytesToClear} bytes`)
      this.push({ tag: 'gc-start', data })
    })
    blindPeer.on('gc-done', ({ bytesCleared }) => {
      const data = { bytesCleared }
      LOG.info('blind-peer', `GC done, cleared ${data.bytesCleared} bytes`)
      this.push({ tag: 'gc-done', data })
    })

    await blindPeer.listen()

    const data = {
      publicKey: hid.normalize(blindPeer.publicKey),
      encryptionPublicKey: hid.normalize(blindPeer.encryptionPublicKey)
    }
    LOG.info(
      'blind-peer',
      `Blind peer listening\n  Public key: ${data.publicKey}\n  Encryption key: ${data.encryptionPublicKey}`
    )
    this.push({ tag: 'listening', data })

    await new Promise((resolve) => session.teardown(resolve))
  }

  async request({ key, peerKey, announce = true, coreOnly = false } = {}) {
    const { sidecar, session } = this

    if (!key) throw ERR_INVALID_INPUT('A core key must be specified')
    if (!peerKey) throw ERR_INVALID_INPUT('A blind peer key must be specified')

    const coreKey = hid.decode(key)
    const blindPeerKey = hid.decode(peerKey)

    const corestore = sidecar.getCorestore()
    await corestore.ready()

    const client = new BlindPeering(sidecar.swarm.dht, corestore, {
      keys: [blindPeerKey],
      pick: 1
    })
    session.teardown(() => client.close().catch(safetyCatch))

    const toAdd = []
    if (coreOnly) {
      const core = corestore.get({ key: coreKey })
      await core.ready()
      toAdd.push(core)
    } else {
      const drive = new Hyperdrive(corestore, key)
      await drive.ready()
      await this.untilBlobs(drive)

      toAdd.push(drive.db.core)
      toAdd.push(drive.blobs.core)
    }

    await Promise.all(
      toAdd.map(async (core) => {
        await client.addCore(core, { announce })
        await this.untilConnected(core, blindPeerKey)
      })
    )

    const data = { key: hid.normalize(coreKey), peerKey: hid.normalize(blindPeerKey), announce }
    LOG.info(
      'blind-peer',
      `Requested blind peer ${data.peerKey} to seed core ${data.key} (announce: ${data.announce})`
    )
    this.push({ tag: 'seeding', data })
  }

  untilBlobs(drive) {
    return new Promise((resolve) => {
      if (drive.blobs) resolve()
      else {
        drive.once('blobs', resolve)
        this.sidecar.swarm.join(drive.discoveryKey)
        drive.getBlobs().catch(safetyCatch)
      }
    })
  }

  async untilConnected(core, peerKey) {
    while (
      !core.peers.some((peer) => hid.normalize(peer.remotePublicKey) === hid.normalize(peerKey))
    ) {
      await new Promise((resolve) => setTimeout(resolve, 20))
    }
  }
}
