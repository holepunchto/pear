'use strict'
const LocalDrive = require('localdrive')
const Bundle = require('../lib/bundle')
const Opstream = require('../lib/opstream')
const parseLink = require('../../../run/parse-link')

module.exports = class Dump extends Opstream {
  constructor (...args) { super((...args) => this.#op(...args), ...args) }

  async #op ({ link, dir, checkout }) {
    const { session, sidecar } = this
    await sidecar.ready()
    const parsed = parseLink(link)
    const isFileLink = parsed.protocol === 'file:'
    const key = parsed.drive.key
    checkout = Number(checkout)
    const bundle = new Bundle({
      corestore: isFileLink ? null : sidecar._getCorestore(null, null),
      drive: isFileLink ? new LocalDrive(parsed.pathname, { followLinks: true }) : null,
      key,
      checkout
    })

    await session.add(bundle)

    if (sidecar.swarm && !isFileLink) bundle.join(sidecar.swarm)

    this.push({ tag: 'dumping', data: { link, dir } })

    if (!isFileLink) {
      try {
        await bundle.calibrate()
      } catch (err) {
        await session.close()
        throw err
      }
    }

    const src = bundle.drive
    await src.ready()

    const prefix = isFileLink ? '/' : parsed.pathname

    if (dir === '-') {
      const pathname = prefix === '/' ? '' : prefix
      const entry = pathname === '' ? null : await src.entry(pathname)
      console.log(parsed.pathname, prefix, entry)
      if (entry === null) {
        for await (const entry of src.list(pathname)) {
          const value = await src.get(entry)
          this.push({ tag: 'file', data: { key: entry.key, value } })
        }
      } else {
        console.log('ah yeah', entry)
      }
      return
    }

    const dst = new LocalDrive(dir)
    const mirror = src.mirror(dst, { prefix })
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
