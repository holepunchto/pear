'use strict'
const path = require('bare-path')
const hypercoreid = require('hypercore-id-encoding')
const { randomBytes } = require('hypercore-crypto')
const plink = require('pear-link')
const Hyperdrive = require('hyperdrive')
const { ERR_INVALID_PROJECT_DIR } = require('pear-errors')
const Opstream = require('../lib/opstream')
const State = require('../state')

module.exports = class Touch extends Opstream {
  constructor(...args) {
    super((...args) => this.#op(...args), ...args)
  }

  async #op({ dir, channel = randomBytes(16).toString('hex') }) {
    const { sidecar } = this
    await sidecar.ready()

    let name = ''
    try {
      const pkg = await State.localPkg({ dir })
      if (pkg !== null) {
        name = State.appname(pkg)
      }
    } catch {
      // ignore
    }

    const corestore = sidecar.getCorestore(name, channel)
    await corestore.ready()
    const key = await Hyperdrive.getDriveKey(corestore)
    const drive = new Hyperdrive(corestore, key)
    await drive.ready()
    const { length, fork } = drive.core
    const verlink = plink.serialize({
      protocol: 'pear:',
      drive: { key, fork, length }
    })
    const link = plink.serialize({ protocol: 'pear:', drive: { key } })
    this.push({
      tag: 'result',
      data: {
        key: hypercoreid.normalize(key),
        length,
        fork,
        link,
        verlink,
        channel
      }
    })
  }
}
