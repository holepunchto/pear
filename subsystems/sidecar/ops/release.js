'use strict'
const hypercoreid = require('hypercore-id-encoding')
const { randomBytes } = require('hypercore-crypto')
const Bundle = require('../lib/bundle')
const Opstream = require('../lib/opstream')
const State = require('../state')
const { ERR_UNSTAGED, ERR_INVALID_CONFIG } = require('../../../errors')

module.exports = class Release extends Opstream {
  constructor (...args) {
    super((...args) => this.#op(...args), ...args)
  }

  async #op ({ name, channel, checkout, link, dir }) {
    const key = link ? hypercoreid.decode(link) : null

    const { session } = this

    const state = new State({
      id: `releaser-${randomBytes(16).toString('hex')}`,
      flags: { checkout, channel, link },
      dir
    })

    await this.sidecar.ready()

    name = name || state.name

    this.push({ tag: 'releasing', data: { name, channel, link } })

    const corestore = this.sidecar._getCorestore(name || state.name, channel, { writable: true })

    const bundle = new Bundle({ corestore, channel, key })
    await session.add(bundle)
    const manifest = await bundle.db.get('manifest')

    if (manifest === null) {
      throw ERR_UNSTAGED(`The "${name}" app has not been staged on ${channel ? '"' + channel + '" channel' : link}.`)
    }

    const invalid = manifest.pear.previewFor !== undefined && manifest.pear.previewFor !== null
    if (invalid) {
      throw ERR_INVALID_CONFIG('The `pear.previewFor` package.json field is invalid for production releases. Remove or null the field in order to release.')
    }

    const currentLength = bundle.db.feed.length
    const releaseLength = checkout || currentLength + 1

    this.push({ tag: 'updating-to', data: { currentLength, releaseLength } })

    await bundle.db.put('release', releaseLength)

    this.push({ tag: 'released', data: { name, channel, link, length: bundle.db.feed.length } })
  }
}
