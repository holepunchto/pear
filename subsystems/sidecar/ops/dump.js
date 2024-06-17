'use strict'
const hypercoreid = require('hypercore-id-encoding')
const Mirror = require('mirror-drive')
const LocalDrive = require('localdrive')
const Bundle = require('../lib/bundle')
const Opstream = require('../lib/opstream')

module.exports = class Dump extends Opstream {
  constructor (...args) { super((...args) => this.#op(...args), ...args) }

  async #op ({ link, dir, checkout }) {
    const { session, sidecar } = this
    await sidecar.ready()
    const key = link ? hypercoreid.decode(link) : null
    checkout = Number(checkout)
    const corestore = sidecar._getCorestore(null, null)
    const bundle = new Bundle({ corestore, key, checkout })

    await session.add(bundle)

    if (sidecar.swarm) bundle.join(sidecar.swarm)

    const pearkey = 'pear://' + hypercoreid.encode(bundle.drive.key)

    this.push({ tag: 'dumping', data: { key: pearkey, dir } })

    try {
      await bundle.calibrate()
    } catch (err) {
      await session.close()
      throw err
    }

    const dst = new LocalDrive(dir)
    const src = bundle.drive

    const mirror = new Mirror(src, dst)

    for await (const diff of mirror) {
      if (diff.op === 'add') {
        this.push({ tag: 'byte-diff', data: { type: 1, sizes: [diff.bytesAdded], message: diff.key } })
      } else if (diff.op === 'change') {
        this.push({ tag: 'byte-diff', data: { type: 0, sizes: [-diff.bytesRemoved, diff.bytesAdded], message: diff.key } })
      } else if (diff.op === 'remove') {
        this.push({ tag: 'byte-diff', data: { type: -1, sizes: [-diff.bytesRemoved], message: diff.key } })
      }
    }
  }
}
