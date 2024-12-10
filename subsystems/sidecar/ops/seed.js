'use strict'
const Bundle = require('../lib/bundle')
const State = require('../state')
const Opstream = require('../lib/opstream')
const hypercoreid = require('hypercore-id-encoding')
const { randomBytes } = require('hypercore-crypto')
const deriveEncryptionKey = require('pw-to-ek')
const { ERR_INVALID_INPUT, ERR_PERMISSION_REQUIRED } = require('../../../errors')
const { SALT } = require('../../../constants')
const Hyperdrive = require('hyperdrive')

module.exports = class Seed extends Opstream {
  constructor (...args) { super((...args) => this.#op(...args), ...args) }

  async #op ({ name, channel, link, verbose, seeders, dir, encryptionKey, cmdArgs } = {}) {
    const { client, session } = this
    const state = new State({
      id: `seeder-${randomBytes(16).toString('hex')}`,
      flags: { channel, link },
      dir,
      cmdArgs
    })
    client.userData = new this.sidecar.App({ state, session })

    this.push({ tag: 'seeding', data: { key: link, name, channel } })
    await this.sidecar.ready()

    const corestore = this.sidecar._getCorestore(name, channel)
    await corestore.ready()
    const key = link ? hypercoreid.decode(link) : await Hyperdrive.getDriveKey(corestore)

    const status = (msg) => this.sidecar.bus.pub({ topic: 'seed', id: client.id, msg })
    const notices = this.sidecar.bus.sub({ topic: 'seed', id: client.id })

    if (encryptionKey) {
      encryptionKey = await deriveEncryptionKey(encryptionKey, SALT)
    } else {
      const query = await this.sidecar.db.get('@pear/bundle', { link: hypercoreid.normalize(key) })
      encryptionKey = query?.encryptionKey ? Buffer.from(query.encryptionKey, 'hex') : null
    }

    const bundle = new Bundle({ corestore, key, channel, status, encryptionKey })

    try {
      await session.add(bundle)
      await bundle.ready()
      if (!bundle.drive.opened) throw new Error('Cannot open Hyperdrive')
    } catch (err) {
      if (err.code !== 'DECODING_ERROR') throw err
      throw new ERR_PERMISSION_REQUIRED('Encryption key required', { key, encrypted: true })
    }

    if (!link && bundle.drive.core.length === 0) {
      throw ERR_INVALID_INPUT('Invalid Channel "' + channel + '" - nothing to seed')
    }

    await bundle.join(this.sidecar.swarm, { seeders, server: true })

    try {
      await bundle.drive.get('/package.json')
    } catch (err) {
      if (err.code !== 'DECODING_ERROR') throw err
      throw new ERR_PERMISSION_REQUIRED('Encryption key required', { key, encrypted: true })
    }

    if (verbose) {
      this.push({ tag: 'meta-key', data: bundle.drive.key.toString('hex') })
      this.push({ tag: 'meta-discovery-key', data: bundle.drive.discoveryKey.toString('hex') })
      this.push({ tag: 'content-key', data: bundle.drive.contentKey.toString('hex') })
    }

    this.push({ tag: 'key', data: hypercoreid.encode(bundle.drive.key) })

    for await (const { msg } of notices) this.push(msg)
    // no need for teardown, seed is tied to the lifecycle of the client
  }
}
