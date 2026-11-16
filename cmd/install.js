'use strict'

const context = require('../context')
const { resolve } = require('bare-path')
const InstallCmd = require('pear-install/cmd')

module.exports = async function install(cmd) {
  const ipc = context.getIPC()
  const { json, only, to } = cmd.flags
  const timeout = (cmd.flags,timeout || 30) * 1000
  const { link } = cmd.args
  
  await InstallCmd.output(json, ipc.install({ link, only, to: to ? resolve(to) : to, timeout }))
}
