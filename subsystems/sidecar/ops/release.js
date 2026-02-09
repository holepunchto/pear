'use strict'
const Hyperdrive = require('hyperdrive')
const { randomBytes } = require('hypercore-crypto')
const { ERR_UNSTAGED } = require('pear-errors')
const plink = require('pear-link')
const Pod = require('../lib/pod')
const Opstream = require('../lib/opstream')
const State = require('../state')

module.exports = class Release extends Opstream {
  constructor(...args) {
    super((...args) => this.#op(...args), ...args)
  }

  async #op({ name, channel, checkout, link, dir, cmdArgs }) {
    const parsed = link ? plink.parse(link) : null
    const key = parsed?.drive.key ?? null
    const state = new State({
      id: `releaser-${randomBytes(16).toString('hex')}`,
      flags: { checkout, channel, link },
      dir,
      cmdArgs
    })
    const { session } = this
    const pkg = await State.localPkg(state)
    await State.build(state, pkg)
    name = name || state.name

    this.push({ tag: 'releasing', data: { name, channel, link } })

    await this.sidecar.ready()

    const corestore = this.sidecar.getCorestore(name, channel, {
      writable: true
    })
    await corestore.ready()

    if (key === null) await Hyperdrive.getDriveKey(corestore)

    const pod = new Pod({ corestore, channel, key })
    await session.add(pod)
    const manifest = await pod.db.get('manifest')

    if (manifest === null) {
      throw ERR_UNSTAGED(
        `Failed to release "${name}" app on ${channel ? '"' + channel + '" channel' : link}.`
      )
    }

    const currentLength = pod.db.feed.length
    const releaseLength = checkout || currentLength + 1

    this.push({ tag: 'updating-to', data: { currentLength, releaseLength } })

    await pod.db.put('release', releaseLength)

    this.push({
      tag: 'released',
      data: { name, channel, link, length: pod.db.feed.length }
    })
  }
}
