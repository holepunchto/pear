'use strict'
const Opstream = require('../lib/opstream')
const Hyperdrive = require('hyperdrive')
const { PLATFORM_DIR } = require('../../../constants')
const { rm } = require('bare-fs').promises
const { existsSync } = require('bare-fs')
const path = require('bare-path')

module.exports = class Delete extends Opstream {
  constructor (...args) { super((...args) => this.#op(...args), ...args) }

  async #op ({ key, clearAppStorage }) {
    const { sidecar } = this
    await sidecar.ready()
    const corestore = sidecar._getCorestore(null, null)
    await corestore.ready()
    const drive = new Hyperdrive(corestore, key)
    await drive.ready()
    await drive.clearAll()
    if (clearAppStorage) {
      const appStorage = path.join(PLATFORM_DIR, 'app-storage', 'by-dkey', drive.discoveryKey.toString('hex'))
      if (existsSync(appStorage)) rm(appStorage, { recursive: true })
    }

    this.push({ tag: 'success' })
  }
}
