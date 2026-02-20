'use strict'
const { randomBytes } = require('hypercore-crypto')
const { ERR_INVALID_INPUT, ERR_UNSTAGED } = require('pear-errors')
const plink = require('pear-link')
const Pod = require('../lib/pod')
const Opstream = require('../lib/opstream')
const State = require('../state')

module.exports = class Release extends Opstream {
  constructor(...args) {
    super((...args) => this.#op(...args), ...args)
  }

  async #op({ name, checkout, link, dir, cmdArgs }) {
    const key = link ? plink.parse(link).drive.key : null
    if (!key) throw ERR_INVALID_INPUT('A valid pear link must be specified.')
    const state = new State({
      id: `releaser-${randomBytes(16).toString('hex')}`,
      flags: { checkout, link },
      dir,
      cmdArgs
    })
    const { session } = this
    const pkg = await State.localPkg(state)
    await State.build(state, pkg)
    name = name || state.name

    this.push({ tag: 'releasing', data: { name, link } })

    await this.sidecar.ready()

    const corestore = this.sidecar.getCorestore(null, null, {
      writable: true
    })
    await corestore.ready()

    const pod = new Pod({ corestore, key })
    await session.add(pod)
    const manifest = await pod.db.get('manifest')

    if (manifest === null) {
      throw ERR_UNSTAGED(`Failed to release "${name}" app on ${link}.`)
    }

    const currentLength = pod.db.feed.length
    const releaseLength = checkout || currentLength + 1

    this.push({ tag: 'updating-to', data: { currentLength, releaseLength } })

    await pod.db.put('release', releaseLength)

    this.push({
      tag: 'released',
      data: { name, link, length: pod.db.feed.length }
    })
  }
}
