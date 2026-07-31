'use strict'
const fs = require('bare-fs')
const path = require('bare-path')
const { PLATFORM_DIR } = require('../../../constants.js')
const { ERR_INVALID_GC_RESOURCE } = require('pear-errors')
const Opstream = require('../lib/opstream')
const hypercoreid = require('hypercore-id-encoding')
const plink = require('pear-link')

module.exports = class GC extends Opstream {
  constructor(...args) {
    super((...args) => this.#op(...args), ...args)
  }

  #op(params) {
    if (params.resource === 'releases') return this.releases(params)
    if (params.resource === 'cores') return this.cores(params)
    throw ERR_INVALID_GC_RESOURCE('Invalid resource to gc: ' + params.resource)
  }

  async releases(params) {
    const { resource } = params
    let count = 0
    const symlinkPath = path.join(PLATFORM_DIR, 'current')
    const dkeyDir = path.join(PLATFORM_DIR, 'by-dkey')

    try {
      await fs.promises.stat(dkeyDir)
    } catch {
      this.push({ tag: 'complete', data: { resource, count } })
      return
    }

    const current = await fs.promises.readlink(symlinkPath)
    const currentDirPath = path.dirname(current)
    const currentDirName = path.basename(currentDirPath)

    const dirs = await fs.promises.readdir(dkeyDir, { withFileTypes: true })

    const dirNames = dirs.filter((dirent) => dirent.isDirectory()).map((dirent) => dirent.name)

    for (const dirName of dirNames) {
      if (dirName !== currentDirName) {
        const dirPath = path.join(dkeyDir, dirName)
        await fs.promises.rm(dirPath, { recursive: true })
        this.push({ tag: 'remove', data: { resource, id: dirName } })
        count++
      }
    }
    this.push({ tag: 'complete', data: { resource, count } })
  }

  async cores(params) {
    const { resource } = params
    const { sidecar } = this

    const discoveryKeys = []
    for await (const dkey of sidecar.corestore.list()) discoveryKeys.push(dkey)
    for (const discoveryKey of discoveryKeys) {
      const dkey = hypercoreid.encode(discoveryKey)
      const info = await sidecar.corestore.storage.getInfo(discoveryKey)
      if (info.auth && info.auth.keyPair) continue

      const core = sidecar.corestore.get({
        discoveryKey: info.discoveryKey,
        active: false
      })
      await core.ready()
      await core.clear(0, core.length)
      const dlink =
        info.auth && info.auth.key ? plink.serialize({ drive: { key: info.auth.key } }) : null
      this.push({
        tag: 'remove',
        data: {
          operation: 'clear',
          resource: resource,
          id: dkey,
          link: dlink
        }
      })
      await core.close()
    }
    await sidecar.corestore.storage.compact()
  }
}
