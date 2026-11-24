'use strict'

const Hyperdrive = require('hyperdrive')
const plink = require('pear-link')
const Installer = require('pear-install')
const Replicator = require('../lib/replicator')
const Opstream = require('../lib/opstream')

module.exports = class Install extends Opstream {
  constructor(...args) {
    super((...args) => this.#op(...args), ...args)
  }

  async #op(opts) {
    const { session, sidecar } = this
    await sidecar.ready()

    const { drive: driveInfo } = plink.parse(opts.link)

    const corestore = this.sidecar.getCorestore()
    await corestore.ready()

    const drive = await session.add(new Hyperdrive(corestore, driveInfo.key))
    const replicator = await session.add(new Replicator(drive))
    const installer = session.add(
      new Installer({
        ...opts,
        corestore: sidecar.corestore,
        swarm: sidecar.swarm
      })
    )

    installer.on('installing', (data) => {
      this.push({ tag: 'installing', data })
    })
    installer.on('app', (data) => {
      this.push({ tag: 'app', data })
    })
    installer.on('stats', (data) => {
      this.push({ tag: 'stats', data })
    })
    installer.on('path', (data) => {
      this.push({ tag: 'path', data })
    })
    installer.on('final', (data) => {
      this.final = data
    })

    await replicator.join(sidecar.swarm, { server: false, client: true })

    try {
      await installer.ready()
    } finally {
      await installer.close()
    }
  }
}
