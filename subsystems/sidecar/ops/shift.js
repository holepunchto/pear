'use strict'
const fs = require('bare-fs')
const path = require('bare-path')
const { randomBytes } = require('hypercore-crypto')
const plink = require('pear-link')
const { PLATFORM_DIR } = require('pear-constants')
const { ERR_INVALID_INPUT } = require('pear-errors')
const Opstream = require('../lib/opstream')

const exists = (path) =>
  fs.promises.stat(path).then(
    () => true,
    () => false
  )

module.exports = class Shift extends Opstream {
  constructor(...args) {
    super((...args) => this.#op(...args), ...args)
  }

  async #op({ src, dst, force }) {
    this.push({ tag: 'moving', data: { src, dst } })

    src = plink.normalize(src)
    dst = plink.normalize(dst)

    if (!src) throw ERR_INVALID_INPUT('src must be specified')
    if (!dst) throw ERR_INVALID_INPUT('dst must be specified')

    const parsedSrc = plink.parse(src)
    const parsedDst = plink.parse(dst)

    if (!parsedSrc?.drive?.key) throw ERR_INVALID_INPUT('Invalid source app key')
    if (!parsedDst?.drive?.key) throw ERR_INVALID_INPUT('Invalid destination app key')

    const srcAppStorage = await this.sidecar.model.getAppStorage(src)
    const dstAppStorage = await this.sidecar.model.getAppStorage(dst)

    if (!srcAppStorage || !(await exists(srcAppStorage)))
      throw ERR_INVALID_INPUT(`No app storage found for ${src}`)
    if (dstAppStorage && !force)
      throw ERR_INVALID_INPUT(`App storage for ${dst} already exists. Use --force to overwrite`)

    const newSrcAppStorage = path.join(
      path.join(PLATFORM_DIR, 'app-storage'),
      'by-random',
      randomBytes(16).toString('hex')
    )
    await this.sidecar.model.shiftAppStorage(src, dst, newSrcAppStorage)

    this.push({
      tag: 'complete',
      data: {
        oldDst: dstAppStorage,
        newDst: srcAppStorage,
        newSrc: newSrcAppStorage,
        src,
        dst
      }
    })
  }
}
