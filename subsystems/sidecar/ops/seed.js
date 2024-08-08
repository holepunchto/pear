'use strict'
const Bundle = require('../lib/bundle')
const State = require('../state')
const { preferences } = State
const Opstream = require('../lib/opstream')
const hypercoreid = require('hypercore-id-encoding')
const { randomBytes } = require('hypercore-crypto')
const { ERR_INVALID_INPUT, ERR_ENCRYPTION_KEY_REQUIRED } = require('../../../errors')

module.exports = class Seed extends Opstream {
  constructor (...args) { super((...args) => this.#op(...args), ...args) }

  async #op ({ name, channel, link, verbose, seeders, dir, cmdArgs } = {}) {
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
    const key = link ? hypercoreid.decode(link) : null

    const log = (msg) => this.sidecar.bus.pub({ topic: 'seed', id: client.id, msg })
    const notices = this.sidecar.bus.sub({ topic: 'seed', id: client.id })

    const encryptionKey = await preferences.get('encryption-key:' + (key ? key.toString('hex') : name + '-' + channel))
    const bundle = new Bundle({ corestore, key, channel, log, encryptionKey })

    try {
      await session.add(bundle)
      await bundle.ready()
      if (!bundle.drive.opened) throw new Error('Cannot open Hyperdrive')
    } catch {
      throw ERR_ENCRYPTION_KEY_REQUIRED('Encryption key required')
    }

    if (key === null && bundle.drive.core.length === 0) {
      throw ERR_INVALID_INPUT('Invalid Channel "' + channel + '" - nothing to seed')
    }

    if (verbose) {
      this.push({ tag: 'meta-key', data: bundle.drive.key.toString('hex') })
      this.push({ tag: 'meta-discovery-key', data: bundle.drive.discoveryKey.toString('hex') })
      this.push({ tag: 'content-key', data: bundle.drive.contentKey.toString('hex') })
    }

    this.push({ tag: 'key', data: hypercoreid.encode(bundle.drive.key) })

    await bundle.join(this.sidecar.swarm, { seeders, server: true })

    for await (const { msg } of notices) this.push(msg)
    // no need for teardown, seed is tied to the lifecycle of the client
  }
}
