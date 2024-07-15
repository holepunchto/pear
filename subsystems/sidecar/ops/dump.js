'use strict'
const Mirror = require('mirror-drive')
const LocalDrive = require('localdrive')
const Bundle = require('../lib/bundle')
const Opstream = require('../lib/opstream')
const parseLink = require('../../../run/parse-link')

module.exports = class Dump extends Opstream {
  constructor (...args) { super((...args) => this.#op(...args), ...args) }

  async #op ({ link, dir, checkout, list }) {
    const { session, sidecar } = this
    await sidecar.ready()
    const parsed = parseLink(link)
    const key = parsed.drive.key
    checkout = Number(checkout)
    list = Number.isNaN(+list) ? -1 : Number(list)
    const corestore = sidecar._getCorestore(null, null)
    const bundle = new Bundle({ corestore, key, checkout })

    await session.add(bundle)

    if (sidecar.swarm) bundle.join(sidecar.swarm)

    this.push({ tag: 'dumping', data: { link, dir, list } })

    try {
      await bundle.calibrate()
    } catch (err) {
      await session.close()
      throw err
    }

    const src = bundle.drive
    await src.ready()
    if (list > -1) dir = '-'
    if (dir === '-') {
      const read = async (pathname, depth = 0) => {
        depth++
        pathname = pathname === '/' ? '' : pathname
        const entry = pathname === '' ? null : await src.entry(pathname)
        if (entry) {
          const value = list > -1 ? null : await src.get(entry)
          this.push({ tag: 'file', data: { key: pathname, value } })
          return
        }
        for await (const file of src.readdir(pathname)) {
          const subpath = pathname + '/' + file
          const value = list > -1 ? null : await src.get(subpath)
          this.push({ tag: 'file', data: { key: subpath, value } })
          if (depth < list || list === 0) {
            await read(subpath, depth)
          }
        }
      }
      await read(parsed.pathname)
      return
    }

    const dst = new LocalDrive(dir)
    const mirror = new Mirror(src, dst, { prefix: parsed.pathname })

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
