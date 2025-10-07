'use strict'
const hypercoreid = require('hypercore-id-encoding')
const { randomBytes } = require('hypercore-crypto')
const Hyperdrive = require('hyperdrive')
const { ERR_INVALID_INPUT, ERR_PERMISSION_REQUIRED } = require('pear-errors')
const Opstream = require('../lib/opstream')
const Replicator = require('../lib/replicator')
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

    const query = await this.sidecar.model.getBundle(
      `pear://${hypercoreid.encode(key)}`
    )
    const encryptionKey = query?.encryptionKey

    const drive = new Hyperdrive(corestore, key, { encryptionKey })
    session.add(drive)

    try {
      await drive.ready()
      if (!drive.opened) throw new Error('Cannot open Hyperdrive')
    } catch (err) {
      if (err.code !== 'DECODING_ERROR') throw err
      throw ERR_PERMISSION_REQUIRED('Encryption key required', {
        key,
        encrypted: true
      })
    }

    const replicator = new Replicator(drive)
    // session.add(replicator)

    replicator.on('announce', () => status({ tag: 'announced' }))
    drive.core.on('peer-add', (peer) => {
      status({
        tag: 'peer-add',
        data: peer.remotePublicKey.toString('hex')
      })
    })
    drive.core.on('peer-remove', (peer) => {
      status({
        tag: 'peer-remove',
        data: peer.remotePublicKey.toString('hex')
      })
    })

    if (!link && drive.core.length === 0) {
      throw ERR_INVALID_INPUT(
        'Invalid Channel "' + channel + '" - nothing to seed'
      )
    }

    await replicator.join(this.sidecar.swarm, { server: true, client: true })

    try {
      await drive.get('/package.json')
    } catch (err) {
      if (err.code !== 'DECODING_ERROR') throw err
      throw ERR_PERMISSION_REQUIRED('Encryption key required', {
        key,
        encrypted: true
      })
    }

    drive.core.download({ start: 0, end: -1 })

    const blobs = await drive.getBlobs()
    blobs.core.download({ start: 0, end: -1 })

    if (verbose) {
      this.push({ tag: 'meta-key', data: drive.key.toString('hex') })
      this.push({
        tag: 'meta-discovery-key',
        data: bundle.drive.discoveryKey.toString('hex')
      })
      this.push({
        tag: 'content-key',
        data: bundle.drive.contentKey.toString('hex')
      })
    }

    this.push({ tag: 'key', data: hypercoreid.encode(drive.key) })

    for await (const { msg } of notices) this.push(msg)
    // no need for teardown, seed is tied to the lifecycle of the client
  }
}
