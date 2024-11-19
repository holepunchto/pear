'use strict'
const fs = require('bare-fs')
const path = require('bare-path')
const { randomBytes, discoveryKey } = require('hypercore-crypto')
const Opstream = require('../lib/opstream')
const parseLink = require('pear-api/parse-link')
const { PLATFORM_DIR, GC } = require('pear-api/constants')
const { ERR_INVALID_INPUT } = require('pear-api/errors')

module.exports = class Shift extends Opstream {
  constructor (...args) {
    super((...args) => this.#op(...args), ...args)
  }

  async #op ({ src, dst, force }) {
    let from = null
    let to = null
    this.push({ tag: 'moving', data: { src, dst } })

    if (!src) throw ERR_INVALID_INPUT('src must be specified')
    if (!dst) throw ERR_INVALID_INPUT('dst must be specified')
    const srcKey = parseLink(src).drive?.key
    const dstKey = parseLink(dst).drive?.key
    if (!srcKey) throw ERR_INVALID_INPUT('Invalid source app key')
    if (!dstKey) throw ERR_INVALID_INPUT('Invalid destination app key')
    const byDkey = path.join(PLATFORM_DIR, 'app-storage', 'by-dkey')
    from = path.join(byDkey, discoveryKey(srcKey).toString('hex'))
    to = path.join(byDkey, discoveryKey(dstKey).toString('hex'))
    const exists = (path) => fs.promises.stat(path).then(() => true, () => false)
    let gc = null
    try {
      if (await exists(from) === false) {
        throw ERR_INVALID_INPUT('No app storage for found for ' + src)
      }
      if (await exists(to)) {
        if (force) {
          gc = path.join(GC, randomBytes(8).toString('hex'))
          await fs.promises.rename(to, gc)
        } else {
          throw ERR_INVALID_INPUT('App storage for ' + dst + ' already exists. Use --force to overwrite')
        }
      }

      await fs.promises.rename(from, to)
    } finally {
      if (gc) await fs.promises.rm(gc, { recursive: true })
    }

    this.push({ tag: 'complete', data: { from, to, src, dst } })
  }
}
