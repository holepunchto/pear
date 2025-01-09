'use strict'
const fs = require('bare-fs')
const path = require('bare-path')
const { randomBytes } = require('hypercore-crypto')
const Opstream = require('../lib/opstream')
const parseLink = require('../../../lib/parse-link')
const { PLATFORM_DIR } = require('../../../constants')
const { ERR_INVALID_INPUT } = require('../../../errors')

const exists = (path) => fs.promises.stat(path).then(() => true, () => false)

module.exports = class Shift extends Opstream {
  constructor (...args) {
    super((...args) => this.#op(...args), ...args)
  }

  async #op ({ src, dst, force }) {
    this.push({ tag: 'moving', data: { src, dst } })

    if (!src) throw ERR_INVALID_INPUT('src must be specified')
    if (!dst) throw ERR_INVALID_INPUT('dst must be specified')
    const srcKey = parseLink(src).drive?.key
    const dstKey = parseLink(dst).drive?.key
    if (!srcKey) throw ERR_INVALID_INPUT('Invalid source app key')
    if (!dstKey) throw ERR_INVALID_INPUT('Invalid destination app key')

    const srcLink = `pear://${srcKey}`
    const dstLink = `pear://${dstKey}`

    const srcAppStorage = await this.sidecar.model.getAppStorage(srcLink)
    const dstAppStorage = await this.sidecar.model.getAppStorage(dstLink)

    if (!srcAppStorage || !(await exists(srcAppStorage))) throw ERR_INVALID_INPUT('No app storage found for ' + src)
    if (dstAppStorage && !force) throw ERR_INVALID_INPUT('App storage for ' + dst + ' already exists. Use --force to overwrite')

    const newSrcAppStorage = path.join(path.join(PLATFORM_DIR, 'app-storage'), 'by-random', randomBytes(16).toString('hex'))
    await this.sidecar.model.shiftAppStorage(srcLink, dstLink, newSrcAppStorage)

    if (dstAppStorage) await fs.promises.rm(dstAppStorage, { recursive: true })

    this.push({ tag: 'complete', data: { from: srcAppStorage, to: dstAppStorage, src, dst } })
  }
}
