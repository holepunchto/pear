'use strict'
const Bundle = require('../lib/bundle')
const State = require('../state')
const Opstream = require('../lib/opstream')
const hypercoreid = require('hypercore-id-encoding')
const { randomBytes } = require('hypercore-crypto')
const { ERR_INVALID_INPUT, ERR_PERMISSION_REQUIRED } = require('../../../errors')
const Store = require('../lib/store')
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

    const log = (msg) => this.sidecar.bus.pub({ topic: 'seed', id: client.id, msg })
    const notices = this.sidecar.bus.sub({ topic: 'seed', id: client.id })

    const permits = new Store('permits')
    const secrets = new Store('encryption-keys')
    const encryptionKeys = await permits.get('encryption-keys') || {}
    encryptionKey = key ? encryptionKeys[hypercoreid.normalize(key)] : encryptionKey ? await secrets.get(encryptionKey) : null

    const bundle = new Bundle({ corestore, key, channel, log, encryptionKey: encryptionKey ? Buffer.from(encryptionKey, 'hex') : null })

    try {
      await session.add(bundle)
      await bundle.ready()
      if (!bundle.drive.opened) throw new Error('Cannot open Hyperdrive')
    } catch {
      throw new ERR_PERMISSION_REQUIRED('Encryption key required', { key, encrypted: true })
    }

    if (!link && bundle.drive.core.length === 0) {
      throw new ERR_INVALID_INPUT('Invalid Channel "' + channel + '" - nothing to seed')
    }

    if (verbose) {
      this.push({ tag: 'meta-key', data: bundle.drive.key.toString('hex') })
      this.push({ tag: 'meta-discovery-key', data: bundle.drive.discoveryKey.toString('hex') })
      this.push({ tag: 'content-key', data: bundle.drive.contentKey.toString('hex') })
    }

    this.push({ tag: 'key', data: hypercoreid.encode(bundle.drive.key) })

    await bundle.join(this.sidecar.swarm, { seeders, server: true })

    try {
      await bundle.drive.get('/package.json')
    } catch {
      throw new ERR_INVALID_INPUT('Encryption key required')
    }

    for await (const { msg } of notices) this.push(msg)
    // no need for teardown, seed is tied to the lifecycle of the client
  }
}
