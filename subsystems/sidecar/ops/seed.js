'use strict'
const hypercoreid = require('hypercore-id-encoding')
const speedometer = require('speedometer')
const plink = require('pear-link')
const { ERR_INVALID_INPUT } = require('pear-errors')
const Opstream = require('../lib/opstream')
const Hyperdrive = require('hyperdrive')
const Replicator = require('../lib/replicator')

module.exports = class Seed extends Opstream {
  constructor(...args) {
    super((...args) => this.#op(...args), ...args)
  }

  _stats({ drive } = {}) {
    const { swarm } = this.sidecar
    const totalConnections = swarm.connections.size
    const { dht } = swarm

    return {
      tag: 'stats',
      data: {
        firewalled: dht.bootstrapped ? (dht.firewalled ? true : false) : undefined,
        peers: drive.core.peers.length,
        driveKey: drive.key?.toString('hex'),
        discoveryKey: drive.discoveryKey?.toString('hex'),
        contentKey: drive.contentKey?.toString('hex') ?? 'pending',
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

  async #op({ link, cmdArgs, statsInterval = 500 } = {}) {
    const { client, session } = this
    const parsed = link ? plink.parse(link) : null
    const key = parsed?.drive.key ?? null
    if (key === null) throw ERR_INVALID_INPUT('A valid pear link must be specified.')

    // not an app but a long running process, setting userData for restart recognition:
    client.userData = { state: { cmdArgs, flags: { link } } }

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
        data: peer.remotePublicKey.toString('hex')
      })
    })
    drive.core.on('peer-remove', (peer) => {
      this.push({
        tag: 'peer-remove',
        data: peer.remotePublicKey.toString('hex')
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
      LOG.trace('seed', `UPLOADING DB BLOCK ${index} - ${byteLength}`)
      this.stats.totals.upload.blocks += 1
      this.stats.totals.upload.bytes += byteLength
      this.stats.speed.upload.bytes(byteLength)
    })
    drive.db.core.on('download', (index, byteLength) => {
      LOG.trace('seed', `DOWNLOADING DB BLOCK ${index} - ${byteLength}`)
      this.stats.totals.download.blocks += 1
      this.stats.totals.download.bytes += byteLength
      this.stats.speed.download.bytes(byteLength)
    })

    if (!drive.opened) throw new Error('Cannot open Hyperdrive')

    await replicator.join(this.sidecar.swarm, { server: true, client: true })

    drive.db.core.download({ start: 0, end: -1 })

    this._statsInterval = setInterval(() => {
      this.push(this._stats({ drive }))
    }, statsInterval)
    this.session.teardown(() => {
      clearInterval(this._statsInterval)
    })

    const blobs = await drive.getBlobs()
    blobs.core.on('upload', (index, byteLength) => {
      LOG.trace('seed', `UPLOADING BLOB BLOCK ${index} - ${byteLength}`)
      this.stats.totals.upload.blocks += 1
      this.stats.totals.upload.bytes += byteLength
      this.stats.speed.upload.bytes(byteLength)
    })
    blobs.core.on('download', (index, byteLength) => {
      LOG.trace('seed', `DOWNLOADING BLOB BLOCK ${index} - ${byteLength}`)
      this.stats.totals.download.blocks += 1
      this.stats.totals.download.bytes += byteLength
      this.stats.speed.download.bytes(byteLength)
    })
    blobs.core.download({ start: 0, end: -1 })

    this.push({ tag: 'key', data: hypercoreid.encode(drive.key) })

    await new Promise((resolve) => this.session.teardown(resolve))
  }
}
