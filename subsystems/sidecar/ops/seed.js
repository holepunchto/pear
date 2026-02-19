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

function throttleAndFinalize(func, delay) {
  let timer = null
  let interval = null

  return (...args) => {
    clearInterval(interval)
    if (timer === null) {
      func(...args)
      timer = setTimeout(() => {
        timer = null
        let x = 0
        interval = setInterval(() => {
          func(...args)
          if (x > 6) clearInterval(interval)
          x += 1
        }, delay * 3)
      }, delay)
    } else {
      clearInterval(interval)
    }
  }
}

module.exports = class Seed extends Opstream {
  constructor(...args) {
    super((...args) => this.#op(...args), ...args)
  }

  async #op({ name, link, verbose, dir, cmdArgs } = {}) {
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

    const totalStats = {
      upload: { blocks: 0, bytes: 0 },
      download: { blocks: 0, bytes: 0 }
    }
    const speedStats = {
      upload: { bytes: speedometer() },
      download: { bytes: speedometer() }
    }

    const pushStats = () => {
      const { swarm } = this.sidecar
      const totalConnections = swarm.connections.size
      const totalConnecting = swarm.connecting
      const { dht } = swarm
      this.push({
        tag: 'stats',
        data: {
          firewalled: dht.bootstrapped ? (dht.firewalled ? true : false) : undefined,
          peers: pod.drive.core.peers.length,
          key: pod.drive.key?.toString('hex'),
          discoveryKey: pod.drive.discoveryKey?.toString('hex'),
          contentKey: pod.drive.contentKey?.toString('hex'),
          link,
          upload: {
            totalBytes: totalStats.upload.bytes,
            totalBlocks: totalStats.upload.blocks,
            speed: speedStats.upload.bytes()
          },
          download: {
            totalBytes: totalStats.download.bytes,
            totalBlocks: totalStats.download.blocks,
            speed: speedStats.download.bytes()
          },
          natType: dht.bootstrapped ? (dht.port ? 'Consistent' : 'Random') : undefined,
          connections: totalConnections,
          connecting: totalConnecting
        }
      })
    }

    const pushStatsThrottled = throttleAndFinalize(pushStats, 400)

    pod.swarm.on('update', () => {
      pushStats()
    })
    pod.drive.core.on('peer-add', (info) => {
      pushStats()
    })

    pod.drive.db.core.on('upload', (index, byteLength) => {
      LOG.info('seed', `UPLOADING DB BLOCK ${index} - ${byteLength}`)
      totalStats.upload.blocks += 1
      totalStats.upload.bytes += byteLength
      speedStats.upload.bytes(byteLength)
      pushStatsThrottled()
    })
    pod.drive.db.core.on('download', (index, byteLength) => {
      LOG.info('seed', `DOWNLOADING DB BLOCK ${index} - ${byteLength}`)
      totalStats.download.blocks += 1
      totalStats.download.bytes += byteLength
      speedStats.download.bytes(byteLength)
      pushStatsThrottled()
    })
    pod.replicator.on('announce', () => {
      pushStats()
    })
    pod.drive.core.on('peer-remove', () => {
      pushStats()
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
      LOG.info('seed', `UPLOADING BLOB BLOCK ${index} - ${byteLength}`)
      totalStats.upload.blocks += 1
      totalStats.upload.bytes += byteLength
      speedStats.upload.bytes(byteLength)
      pushStatsThrottled()
    })
    blobs.core.on('download', (index, byteLength, from) => {
      LOG.info('seed', `DOWNLOADING BLOB BLOCK ${index} - ${byteLength}`)
      totalStats.download.blocks += 1
      totalStats.download.bytes += byteLength
      speedStats.download.bytes(byteLength)
      pushStatsThrottled()
    })
    blobs.core.download({ start: 0, end: -1 })

    pushStats()

    if (verbose) {
      this.push({ tag: 'meta-key', data: pod.drive.key.toString('hex') })
      this.push({
        tag: 'meta-discovery-key',
        data: pod.drive.discoveryKey.toString('hex')
      })
      this.push({
        tag: 'content-key',
        data: pod.drive.contentKey.toString('hex')
      })
    }

    this.push({ tag: 'key', data: hypercoreid.encode(pod.drive.key) })

    for await (const { msg } of notices) this.push(msg)
    // no need for teardown, seed is tied to the lifecycle of the client
  }
}
