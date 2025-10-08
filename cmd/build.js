'use strict'
const os = require('bare-os')
const pearBuild = require('pear-build')
const plink = require('pear-link')
const { outputter, ansi } = require('pear-terminal')
const { ERR_INVALID_INPUT } = require('pear-errors')

const output = outputter('build', {
  init: ({ dir }) => `\n${ansi.pear} Building into ${dir}\n`,
  generate: () => 'Generating project...\n',
  build: () => 'Compiling project...\n',
  complete: ({ dir }) => `\n${ansi.tick} Built appling at ${dir}\n`,
  error: ({ message }) => `Error: ${message}\n`
})

module.exports = (ipc) => {
  const kIPC = Symbol('ipc')
  class API {
    static IPC = kIPC
    get [kIPC]() {
      return ipc
    }
  }
  global.Pear = new API()

  return async function build(cmd) {
    const { json } = cmd.flags
    const channel = cmd.args.channel
    const link = cmd.args.link
    const { drive }  = plink.parse(link)
    if (!drive.key) throw ERR_INVALID_INPUT(`Link "${link}" is not a valid key`)
    const { dir = os.cwd() } = cmd.args
    await output(json, pearBuild({ link, dir }))
  }
}
