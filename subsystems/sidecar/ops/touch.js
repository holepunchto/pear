'use strict'
const hypercoreid = require('hypercore-id-encoding')
const { randomBytes } = require('hypercore-crypto')
const plink = require('pear-link')
const Hyperdrive = require('hyperdrive')
const Opstream = require('../lib/opstream')
const State = require('../state')

module.exports = class Touch extends Opstream {
  constructor(...args) {
    super((...args) => this.#op(...args), ...args)
  }

  async #op({ dir }) {
    const { sidecar } = this
    await sidecar.ready()

    let name = '!touch'
    let namespace = randomBytes(16).toString('hex')
    if (dir) {
      try {
        const pkg = await State.localPkg({ dir })
        if (pkg !== null) {
          name = State.appname(pkg)
          namespace = name
        }
      } catch {
        // ignore
      }
    }

    const corestore = sidecar.getCorestore(name, namespace)
    await corestore.ready()
    const key = await Hyperdrive.getDriveKey(corestore)
    const drive = new Hyperdrive(corestore, key)
    await drive.ready()
    const { length, fork } = drive.core
    const link = plink.serialize({ protocol: 'pear:', drive: { key } })
    this.final = {
      key: hypercoreid.normalize(key),
      length,
      fork,
      link
    }
  }
}
