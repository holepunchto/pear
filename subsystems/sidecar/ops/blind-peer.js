'use strict'
const path = require('bare-path')
const hid = require('hypercore-id-encoding')
const safetyCatch = require('safety-catch')
const { ERR_INVALID_INPUT, ERR_OPERATION_FAILED } = require('pear-errors')
const Opstream = require('../lib/opstream')
const BlindPeer = require('blind-peer')
const BlindPeering = require('blind-peering')
const Hyperdrive = require('hyperdrive')

const CORE_DOWNLOADED_DEBOUNCE_MS = 10000

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
      subcommand: 'identity',
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

    const downloadedDebounces = new Map()
    const clearDownloadedDebounces = () => {
      for (const timer of downloadedDebounces.values()) {
        clearTimeout(timer)
      }
      downloadedDebounces.clear()
    }

    blindPeer.on('close', () => {
      clearDownloadedDebounces()
      if (sidecar.activeBlindPeer === blindPeer) sidecar.activeBlindPeer = null
    })
    session.teardown(clearDownloadedDebounces)

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
      const key = hid.normalize(core.key)
      if (downloadedDebounces.has(key)) {
        clearTimeout(downloadedDebounces.get(key))
      }
      const timer = setTimeout(() => {
        downloadedDebounces.delete(key)
        const data = { key }
        LOG.info('blind-peer', `Core fully downloaded: ${data.key}`)
        this.push({ tag: 'core-downloaded', data })
      }, CORE_DOWNLOADED_DEBOUNCE_MS)
      timer.unref()
      downloadedDebounces.set(key, timer)
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
    LOG.info('blind-peer', `Blind peer started listening using public key: ${data.publicKey}`)
    this.push({ tag: 'listening', data })

    await new Promise((resolve) => session.teardown(resolve))
  }

  async request({ key, peerKey, announce = true, coreOnly = false, timeout = 30000 } = {}) {
    const { sidecar, session } = this

    if (!key) throw ERR_INVALID_INPUT('A core key must be specified')
    if (!peerKey) throw ERR_INVALID_INPUT('A blind peer key must be specified')

    const coreKey = hid.decode(key)
    const blindPeerKey = hid.decode(peerKey)

    const corestore = sidecar.getCorestore()
    await corestore.ready()

    const normalizedPeerKey = hid.normalize(blindPeerKey)
    const normalizedCoreKey = hid.normalize(coreKey)

    const client = new BlindPeering(sidecar.swarm.dht, corestore, {
      keys: [blindPeerKey],
      pick: 1
    })
    session.teardown(() => client.close().catch(safetyCatch))

    const toAdd = []
    if (coreOnly) {
      const core = corestore.get({ key: coreKey })
      await core.ready()
      session.teardown(() => core.close().catch(safetyCatch))
      toAdd.push(core)
    } else {
      const drive = new Hyperdrive(corestore, coreKey)
      await drive.ready()
      session.teardown(() => drive.close().catch(safetyCatch))
      await this.untilBlobs(drive)

      toAdd.push(drive.db.core)
      toAdd.push(drive.blobs.core)
    }

    await Promise.all(
      toAdd.map(async (core) => {
        const subCoreKey = hid.normalize(core.key)
        LOG.info('blind-peer-request', `Requesting core ${subCoreKey} to be added`)
        this.push({
          tag: 'adding-core',
          data: { key: subCoreKey, peerKey: normalizedPeerKey, announce }
        })
        await this.addCore(client, core, {
          announce,
          peerKey: normalizedPeerKey,
          timeout
        })

        await this.untilConnected(core, blindPeerKey, { timeout })
        LOG.info('blind-peer-request', `Successfully added core ${subCoreKey}`)
        this.push({
          tag: 'added-core',
          data: { key: subCoreKey, peerKey: normalizedPeerKey }
        })
      })
    )

    const type = coreOnly ? 'core' : 'drive'
    const data = {
      subcommand: 'request',
      key: normalizedCoreKey,
      peerKey: normalizedPeerKey,
      announce,
      coreOnly: !!coreOnly
    }
    LOG.info(
      'blind-peer-request',
      `Requested blind peer to seed ${type} ${data.key} (announce: ${data.announce})`
    )
    this.final = data
  }

  async addCore(client, core, { announce, peerKey, timeout } = {}) {
    const { promise, reject } = Promise.withResolvers()
    let timer = null

    timer = setTimeout(() => {
      reject(new ERR_OPERATION_FAILED(`Timed out connecting to blind peer ${peerKey} to connect`))
    }, timeout)
    timer.unref()

    try {
      await Promise.race([client.addCore(core, { announce }), promise])
    } finally {
      if (timer) clearTimeout(timer)
    }
  }

  untilBlobs(drive) {
    if (drive.blobs) return Promise.resolve()

    const { promise, resolve, reject } = Promise.withResolvers()
    const discovery = this.sidecar.swarm.join(drive.discoveryKey, {
      server: false,
      client: true
    })

    const cleanup = () => {
      drive.off('blobs', onBlobs)
      discovery.destroy().catch(safetyCatch)
    }

    const onBlobs = () => {
      cleanup()
      resolve()
    }

    drive.once('blobs', onBlobs)
    drive.getBlobs().catch((err) => {
      cleanup()
      reject(err)
    })

    return promise
  }

  untilConnected(core, peerKey, { timeout = 15000 } = {}) {
    const normalizedPeerKey = hid.normalize(peerKey)
    if (core.peers.some((peer) => hid.normalize(peer.remotePublicKey) === normalizedPeerKey)) {
      return Promise.resolve()
    }

    const { promise, resolve, reject } = Promise.withResolvers()
    let timer = null
    let done = false

    const cleanup = () => {
      if (done) return
      done = true
      if (timer) clearTimeout(timer)
      core.off('peer-add', onPeerAdd)
      core.off('close', onClose)
    }

    const onPeerAdd = (peer) => {
      if (hid.normalize(peer.remotePublicKey) === normalizedPeerKey) {
        cleanup()
        resolve()
      }
    }

    const onClose = () => {
      if (done) return
      cleanup()
      reject(new ERR_OPERATION_FAILED('Core was closed before blind peer connected'))
    }

    const onTeardown = () => {
      if (done) return
      cleanup()
      reject(new ERR_OPERATION_FAILED('Session was closed before blind peer connected'))
    }

    timer = setTimeout(() => {
      if (done) return
      cleanup()
      reject(new ERR_OPERATION_FAILED(`Timed out waiting for blind peer ${normalizedPeerKey}`))
    }, timeout)
    timer.unref()

    core.on('peer-add', onPeerAdd)
    core.on('close', onClose)
    this.session.teardown(onTeardown)

    if (core.peers.some((peer) => hid.normalize(peer.remotePublicKey) === normalizedPeerKey)) {
      cleanup()
      resolve()
    }

    return promise
  }
}
