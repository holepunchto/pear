'use strict'

const Installer = require('pear-install')
const Opstream = require('../lib/opstream')

module.exports = class Install extends Opstream {
  constructor(...args) {
    super((...args) => this.#op(...args), ...args)
  }

  async #op(opts) {
    const { session, sidecar } = this
    await sidecar.ready()

    const installer = new Installer({
      ...opts,
      corestore: sidecar.corestore,
      swarm: sidecar.swarm
    })
    session.teardown(() => installer.close())

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

    try {
      await installer.ready()
    } finally {
      await installer.close()
    }
  }
}
