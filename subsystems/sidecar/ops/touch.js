'use strict'
const path = require('bare-path')
const hypercoreid = require('hypercore-id-encoding')
const Hyperdrive = require('hyperdrive')
const { ERR_INVALID_PROJECT_DIR } = require('pear-errors')
const Opstream = require('../lib/opstream')
const State = require('../state')

module.exports = class Touch extends Opstream {
  constructor(...args) {
    super((...args) => this.#op(...args), ...args)
  }

  async #op({ dir, channel }) {
    const { sidecar } = this
    await sidecar.ready()
    const pkg = await State.localPkg({ dir })
    if (pkg === null) {
      throw ERR_INVALID_PROJECT_DIR(
        `"${path.join(dir, 'package.json')}" not found. Pear project must have a package.json`
      )
    }
    const corestore = sidecar.getCorestore(State.appname(pkg), channel)
    await corestore.ready()
    const key = await Hyperdrive.getDriveKey(corestore)
    this.push({
      tag: 'result',
      data: { key: hypercoreid.normalize(key), channel }
    })
  }
}
