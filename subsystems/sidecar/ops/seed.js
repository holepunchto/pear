'use strict'
const hypercoreid = require('hypercore-id-encoding')
const speedometer = require('speedometer')
const safetyCatch = require('safety-catch')
const { ERR_INVALID_INPUT } = require('pear-errors')
const Opstream = require('../lib/opstream')
const Hyperdrive = require('hyperdrive')
const Replicator = require('../lib/replicator')
const { createBlindPeering, requestCores } = require('../lib/blind-peer')
const { parse } = require('../../../lib/link')

module.exports = class Seed extends Opstream {
  constructor(...args) {
    super((...args) => this.#op(...args), ...args)
  }

  _stats({ drive, name, semver } = {}) {
    const { swarm } = this.sidecar
    const totalConnections = swarm.connections.size
    const { dht } = swarm

    return {
      tag: 'stats',
      data: {
        firewalled: dht.bootstrapped ? (dht.firewalled ? true : false) : undefined,
        peers: drive.core.peers.length,
        driveKey: drive.key ? hypercoreid.encode(drive.key) : undefined,
        driveLength: drive.core.length,
        blobsByteLength: drive.blobs?.core.byteLength ?? 0,
        name,
        semver,
        discoveryKey: drive.discoveryKey ? hypercoreid.encode(drive.discoveryKey) : undefined,
        contentKey: drive.contentKey ? hypercoreid.encode(drive.contentKey) : 'pending',
        whoami: hypercoreid.encode(this.sidecar.keyPair.publicKey),
        upload: {
          totalBytes: this.stats.totals.upload.bytes,
          totalBlocks: this.stats.totals.upload.blocks,
          speed: this.stats.speed.upload.bytes()
        },
        download: {
          totalBytes: this.stats.totals.download.bytes,
          totalBlocks: this.stats.totals.download.blocks,
          speed: this.stats.speed.download.bytes()
        },
        natType: dht.bootstrapped ? (dht.port ? 'Consistent' : 'Random') : undefined,
        connections: totalConnections
      }
    }
  }

  async #op({ link, cmdArgs, untilSync, blindPeer, statsInterval = 500 } = {}) {
    if (
      untilSync &&
      (!Array.isArray(untilSync) || untilSync.some((k) => !hypercoreid.isValid(k)))
    ) {
      throw ERR_INVALID_INPUT('--until-sync <key> must supply a valid z32 key')
    }
    if (blindPeer && !hypercoreid.isValid(blindPeer)) {
      throw ERR_INVALID_INPUT('--blind-peer <key> must supply a valid z32 key')
    }

    const { client, session } = this
    const parsed = parse(link)
    const key = parsed?.drive.key

    // not an app but a long running process, setting userData for restart recognition:
    client.userData = { state: { cmdArgs, flags: { link, untilSync, blindPeer } } }

    this.push({ tag: 'seeding', data: { key: hypercoreid.encode(key), link } })
    await this.sidecar.ready()

    const corestore = this.sidecar.getCorestore()
    await corestore.ready()

    const drive = await session.add(new Hyperdrive(corestore, key))
    const replicator = await session.add(new Replicator(drive))

    replicator.on('announce', () => this.push({ tag: 'announced' }))
    drive.core.on('peer-add', (peer) => {
      this.push({
        tag: 'peer-add',
        data: hypercoreid.encode(peer.remotePublicKey)
      })
    })
    drive.core.on('peer-remove', (peer) => {
      this.push({
        tag: 'peer-remove',
        data: hypercoreid.encode(peer.remotePublicKey)
      })
    })

    this.stats = {
      totals: {
        upload: { blocks: 0, bytes: 0 },
        download: { blocks: 0, bytes: 0 }
      },
      speed: {
        upload: { bytes: speedometer() },
        download: { bytes: speedometer() }
      }
    }

    drive.db.core.on('upload', (index, byteLength) => {
      LOG.trace('seed', `Uploading db block ${index} - ${byteLength}`)
      this.stats.totals.upload.blocks += 1
      this.stats.totals.upload.bytes += byteLength
      this.stats.speed.upload.bytes(byteLength)
    })
    drive.db.core.on('download', (index, byteLength) => {
      LOG.trace('seed', `Downloading db block ${index} - ${byteLength}`)
      this.stats.totals.download.blocks += 1
      this.stats.totals.download.bytes += byteLength
      this.stats.speed.download.bytes(byteLength)
    })

    if (!drive.opened) throw new Error('Cannot open Hyperdrive')

    await replicator.join(this.sidecar.swarm, { server: true, client: true })

    drive.db.core.download({ start: 0, end: -1 })

    const manifest = await drive.get('/package.json')
    const pkg = manifest ? JSON.parse(manifest) : {}
    const name = pkg.name ?? ''
    const semver = pkg.version ?? ''

    this._statsInterval = setInterval(() => {
      this.push(this._stats({ drive, name, semver }))
    }, statsInterval)
    this.session.teardown(() => {
      clearInterval(this._statsInterval)
    })

    const blobs = await drive.getBlobs()
    blobs.core.on('upload', (index, byteLength) => {
      LOG.trace('seed', `Uploading blob block ${index} - ${byteLength}`)
      this.stats.totals.upload.blocks += 1
      this.stats.totals.upload.bytes += byteLength
      this.stats.speed.upload.bytes(byteLength)
    })
    blobs.core.on('download', (index, byteLength) => {
      LOG.trace('seed', `Downloading blob block ${index} - ${byteLength}`)
      this.stats.totals.download.blocks += 1
      this.stats.totals.download.bytes += byteLength
      this.stats.speed.download.bytes(byteLength)
    })
    blobs.core.download({ start: 0, end: -1 })

    this.push({ tag: 'key', data: hypercoreid.encode(drive.key) })

    if (blindPeer) {
      const blindPeerClient = createBlindPeering(this.sidecar.swarm.dht, corestore, blindPeer)
      session.teardown(() => blindPeerClient.close().catch(safetyCatch))
      await requestCores(blindPeerClient, [drive.db.core, blobs.core], {
        peerKey: blindPeer,
        announce: true,
        teardown: (fn) => session.teardown(fn)
      })
    }

    if (untilSync) {
      const synced = (core, key) => {
        const peer = core.peers.find((peer) => hypercoreid.normalize(peer.remotePublicKey) === key)
        return peer && peer.remoteContiguousLength >= core.length
      }

      for (const key of untilSync.map(hypercoreid.normalize)) {
        while (!synced(drive.db.core, key)) {
          await new Promise((resolve) => setTimeout(resolve, 20))
        }
        if (blobs.core.length) {
          while (!synced(blobs.core, key)) {
            await new Promise((resolve) => setTimeout(resolve, 20))
          }
        }

        LOG.info(
          'seed',
          `synced drive ${hypercoreid.encode(drive.key)} with ${key} (length db: ${drive.db.core.length} blob: ${blobs.core.length})`
        )
        this.push({ tag: 'peer-sync', data: key })
      }

      LOG.info('seed', `--until-sync ${untilSync} completed`)
      await this.session.close()
      return
    }

    await new Promise((resolve) => this.session.teardown(resolve))
  }
}
