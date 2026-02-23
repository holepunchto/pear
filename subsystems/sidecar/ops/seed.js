'use strict'
const hypercoreid = require('hypercore-id-encoding')
const { randomBytes } = require('hypercore-crypto')
const plink = require('pear-link')
const { ERR_PERMISSION_REQUIRED } = require('pear-errors')
const Pod = require('../lib/pod')
const Opstream = require('../lib/opstream')
const State = require('../state')

module.exports = class Seed extends Opstream {
  constructor(...args) {
    super((...args) => this.#op(...args), ...args)
  }

  async #op({ link, verbose, dir, cmdArgs } = {}) {
    const { client, session } = this
    const key = plink.parse(link).drive.key
    const state = new State({
      id: `seeder-${randomBytes(16).toString('hex')}`,
      flags: { link },
      dir,
      cmdArgs
    })

    // not an app but a long running process, setting userData for restart recognition:
    client.userData = { state }

    this.push({ tag: 'seeding', data: { key: link } })
    await this.sidecar.ready()

    const corestore = this.sidecar.getCorestore(state.name, null)
    await corestore.ready()

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

    pod.drive.core.download({ start: 0, end: -1 })

    const blobs = await pod.drive.getBlobs()
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
