'use strict'
const hypercoreid = require('hypercore-id-encoding')
const { randomBytes } = require('hypercore-crypto')
const speedometer = require('speedometer')
const Hyperdrive = require('hyperdrive')
const plink = require('pear-link')
const { ERR_INVALID_INPUT, ERR_PERMISSION_REQUIRED } = require('pear-errors')
const Pod = require('../lib/pod')
const Opstream = require('../lib/opstream')
const State = require('../state')

module.exports = class Seed extends Opstream {
  constructor(...args) {
    super((...args) => this.#op(...args), ...args)
  }

  _stats({ link, pod, uploadStopped = false, downloadStopped = false } = {}) {
    const { swarm } = this.sidecar
    const totalConnections = swarm.connections.size
    const totalConnecting = swarm.connecting
    const { dht } = swarm

    return {
      tag: 'stats',
      data: {
        firewalled: dht.bootstrapped ? (dht.firewalled ? true : false) : undefined,
        peers: pod.drive.core.peers.length,
        key: pod.drive.key?.toString('hex'),
        discoveryKey: pod.drive.discoveryKey?.toString('hex'),
        contentKey: pod.drive.contentKey?.toString('hex'),
        link,
        upload: {
          totalBytes: this.stats.totals.upload.bytes,
          totalBlocks: this.stats.speed.upload.blocks,
          speed: uploadStopped ? 0 : this.stats.speed.upload.bytes()
        },
        download: {
          totalBytes: this.stats.totals.download.bytes,
          totalBlocks: this.stats.totals.download.blocks,
          speed: downloadStopped ? 0 : this.stats.speed.download.bytes()
        },
        natType: dht.bootstrapped ? (dht.port ? 'Consistent' : 'Random') : undefined,
        connections: totalConnections,
        connecting: totalConnecting
      }
    }
  }

  async #op({ name, link, dir, cmdArgs } = {}) {
    const { client, session } = this
    const parsed = link ? plink.parse(link) : null
    const keyFromLink = parsed?.drive.key ?? null
    const namespace = keyFromLink ? null : link
    const state = new State({
      id: `seeder-${randomBytes(16).toString('hex')}`,
      flags: { link },
      dir,
      cmdArgs
    })

    // not an app but a long running process, setting userData for restart recognition:
    client.userData = { state }

    this.push({ tag: 'seeding', data: { key: keyFromLink ? link : null, name } })
    await this.sidecar.ready()

    const corestore = this.sidecar.getCorestore(name, namespace)
    await corestore.ready()
    const key = keyFromLink || (await Hyperdrive.getDriveKey(corestore))

    const status = (msg) => this.sidecar.bus.pub({ topic: 'seed', id: client.id, msg })
    const notices = this.sidecar.bus.sub({ topic: 'seed', id: client.id })

    const traits = await this.sidecar.model.getTraits(`pear://${hypercoreid.encode(key)}`)
    const encryptionKey = traits?.encryptionKey

    const pod = new Pod({
      swarm: this.sidecar.swarm,
      corestore,
      key,
      status,
      encryptionKey
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

    let uploadStoppedTimer
    const waitForUploadStopped = () => {
      if (uploadStoppedTimer) clearTimeout(uploadStoppedTimer)
      uploadStoppedTimer = setTimeout(() => {
        this.push(this._stats({ pod, link, uploadStopped: true }))
      }, 1000)
    }
    let downloadStoppedTimer
    const waitForDownloadStopped = () => {
      if (downloadStoppedTimer) clearTimeout(downloadStoppedTimer)
      downloadStoppedTimer = setTimeout(() => {
        this.push(this._stats({ pod, link, downloadStopped: true }))
      }, 1000)
    }

    pod.swarm.on('update', () => {
      this.push(this._stats({ pod, link }))
    })
    pod.drive.core.on('peer-add', () => {
      this.push(this._stats({ pod, link }))
    })

    pod.drive.db.core.on('upload', (index, byteLength) => {
      LOG.trace('seed', `UPLOADING DB BLOCK ${index} - ${byteLength}`)
      this.stats.totals.upload.blocks += 1
      this.stats.totals.upload.bytes += byteLength
      this.stats.speed.upload.bytes(byteLength)
      this.push(this._stats({ pod, link }))
      waitForUploadStopped()
    })
    pod.drive.db.core.on('download', (index, byteLength) => {
      LOG.trace('seed', `DOWNLOADING DB BLOCK ${index} - ${byteLength}`)
      this.stats.totals.download.blocks += 1
      this.stats.totals.download.bytes += byteLength
      this.stats.speed.download.bytes(byteLength)
      this.push(this._stats({ pod, link }))
      waitForDownloadStopped()
    })
    pod.replicator.on('announce', () => {
      this.push(this._stats({ pod, link }))
    })
    pod.drive.core.on('peer-remove', () => {
      this.push(this._stats({ pod, link }))
    })

    try {
      await session.add(pod)
      await pod.ready()
      if (!pod.drive.opened) throw new Error('Cannot open Hyperdrive')
    } catch (err) {
      if (err.code !== 'DECODING_ERROR') throw err
      throw ERR_PERMISSION_REQUIRED('Encryption key required', {
        key,
        encrypted: true
      })
    }

    if (namespace && pod.drive.core.length === 0) {
      throw ERR_INVALID_INPUT('Invalid link "' + link + '" - nothing to seed')
    }

    await pod.join({ server: true })

    try {
      await pod.drive.get('/package.json')
    } catch (err) {
      if (err.code !== 'DECODING_ERROR') throw err
      throw ERR_PERMISSION_REQUIRED('Encryption key required', {
        key,
        encrypted: true
      })
    }

    const blobs = await pod.drive.getBlobs()
    blobs.core.on('upload', (index, byteLength, from) => {
      LOG.trace('seed', `UPLOADING BLOB BLOCK ${index} - ${byteLength}`)
      this.stats.totals.upload.blocks += 1
      this.stats.totals.upload.bytes += byteLength
      this.stats.speed.upload.bytes(byteLength)
      this.push(this._stats({ pod, link }))
      waitForUploadStopped()
    })
    blobs.core.on('download', (index, byteLength, from) => {
      LOG.trace('seed', `DOWNLOADING BLOB BLOCK ${index} - ${byteLength}`)
      this.stats.totals.download.blocks += 1
      this.stats.totals.download.bytes += byteLength
      this.stats.speed.download.bytes(byteLength)
      this.push(this._stats({ pod, link }))
      waitForDownloadStopped()
    })
    blobs.core.download({ start: 0, end: -1 })

    this.push(this._stats({ pod, link }))

    this.push({ tag: 'key', data: hypercoreid.encode(pod.drive.key) })

    for await (const { msg } of notices) this.push(msg)
    // no need for teardown, seed is tied to the lifecycle of the client
  }
}
