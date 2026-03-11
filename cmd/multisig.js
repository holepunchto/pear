'use strict'
const { outputter } = require('pear-terminal')

class Multisig {
  static output = outputter('data', {
    final: (result, { tag }) => {}
  })

  constructor(cmd) {
    this.cmd = cmd
    this.ipc = global.Pear[global.Pear.constructor.IPC]
    this.json = cmd.command.parent.flags.json
  }

  async link() {
    await Multisig.output(this.json, this.ipc.multisig({ action: 'link' }))
  }

  async request() {
    const { force, peerUpdateTimeout } = cmd.flags
    const { link } = cmd.args
    await Multisig.output(
      this.json,
      this.ipc.multisig({ action: 'request', link, force, peerUpdateTimeout })
    )
  }

  async verify() {
    const { peerUpdateTimeout } = cmd.flags
    const { request } = cmd.args
    const responses = cmd.rest
    await Multisig.output(
      this.json,
      this.ipc.multisig({ action: 'verify', request, peerUpdateTimeout, responses })
    )
  }

  async commit() {
    const { dryRun, forceDangerous, peerUpdateTimeout } = cmd.flags
    const { request } = cmd.args
    await Multisig.output(
      this.json,
      this.ipc.multisig({ action: 'commit', dryRun, request, forceDangerous, peerUpdateTimeout })
    )
  }
}

module.exports = (cmd) => new Multisig(cmd)[cmd.command.name]()
