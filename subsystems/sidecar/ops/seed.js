'use strict'
const hypercoreid = require('hypercore-id-encoding')
const { randomBytes } = require('hypercore-crypto')
const speedometer = require('speedometer')
const Hyperdrive = require('hyperdrive')
const { ERR_INVALID_INPUT, ERR_PERMISSION_REQUIRED } = require('pear-errors')
const Pod = require('../lib/pod')
const Opstream = require('../lib/opstream')
const State = require('../state')

module.exports = class Seed extends Opstream {
  constructor(...args) {
    super((...args) => this.#op(...args), ...args)
  }

  async #op({ name, channel, link, verbose, dir, cmdArgs } = {}) {
    const { client, session } = this
    const state = new State({
      id: `seeder-${randomBytes(16).toString('hex')}`,
      flags: { channel, link },
      dir,
      cmdArgs
    })

    // not an app but a long running process, setting userData for restart recognition:
    client.userData = { state }

    this.push({ tag: 'seeding', data: { key: link, name, channel } })
    await this.sidecar.ready()

    const corestore = this.sidecar.getCorestore(name, channel)
    await corestore.ready()
    const key = link
      ? hypercoreid.decode(link)
      : await Hyperdrive.getDriveKey(corestore)

    const status = (msg) =>
      this.sidecar.bus.pub({ topic: 'seed', id: client.id, msg })
    const notices = this.sidecar.bus.sub({ topic: 'seed', id: client.id })

    const traits = await this.sidecar.model.getTraits(
      `pear://${hypercoreid.encode(key)}`
    )
    const encryptionKey = traits?.encryptionKey

    const pod = new Pod({
      swarm: this.sidecar.swarm,
      corestore,
      key,
      channel,
      status,
      encryptionKey
    })

    const speedStats = {
      upload: { blocks: speedometer(), bytes: speedometer() },
      download: { blocks: speedometer(), bytes: speedometer() }
    }

    const pushStats = () => {
      const { swarm } = this.sidecar
      const totalConnections = swarm.connections.size
      const totalConnecting = swarm.connecting
      const { dht } = swarm
      this.push({
        tag: 'stats',
        data: {
          firewalled: dht.bootstrapped
            ? dht.firewalled
              ? true
              : false
            : undefined,
          peers: pod.drive.core.peers.length,
          discoveryKey: pod.drive.discoveryKey.toString('hex'),
          contentKey: pod.drive.contentKey.toString('hex'),
          link,
          upload: {
            // blocks: speedStats.upload.blocks(),
            speed: speedStats.upload.bytes()
          },
          download: {
            // blocks: speedStats.download.blocks(),
            speed: speedStats.download.bytes()
          },
          // download: speedStats.download,
          natType: dht.bootstrapped
            ? dht.port
              ? 'Consistent'
              : 'Random'
            : undefined,
          connections: totalConnections,
          connecting: totalConnecting
        }
      })
    }

    setInterval(() => {
      pushStats()
    }, 200)

    pod.swarm.on('update', () => {
      pushStats(pod, { link })
    })
    pod.drive.core.on('peer-add', () => pushStats())
    pod.drive.db.core.on('upload', (index, byteLength) => {
      LOG.info('seed', `UPLOADING DB BLOCK ${index} - ${byteLength}`)
      speedStats.upload.blocks(1)
      speedStats.upload.bytes(byteLength)
      // pushStats()
    })
    pod.drive.db.core.on('download', (index, byteLength) => {
      LOG.info('seed', `DOWNLOADING DB BLOCK ${index} - ${byteLength}`)
      speedStats.upload.blocks(1)
      speedStats.upload.bytes(byteLength)
      // pushStats()
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

    if (!link && pod.drive.core.length === 0) {
      throw ERR_INVALID_INPUT(
        'Invalid Channel "' + channel + '" - nothing to seed'
      )
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
      speedStats.upload.blocks(1)
      speedStats.upload.bytes(byteLength)
      // pushStats()
    })
    blobs.core.on('download', (index, byteLength, from) => {
      LOG.info('seed', `DOWNLOADING BLOB BLOCK ${index} - ${byteLength}`)
      speedStats.download.blocks(1)
      speedStats.download.bytes(byteLength)
      // pushStats()
    })
    blobs.core.download({ start: 0, end: -1 })

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
