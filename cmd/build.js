'use strict'
const os = require('bare-os')
const { outputter, ansi } = require('pear-terminal')
const pearBuild = require('pear-build')
const plink = require('pear-link')
const { ERR_INVALID_INPUT } = require('pear-errors')

const output = outputter('build', {
  init: ({ dir }) => `\n${ansi.pear} Building appling into ${dir}\n`,
  generate: () => 'Generating project...\n',
  build: () => 'Building project...\n',
  complete: ({ dir }) => `\n${ansi.tick} Built appling at ${dir}\n`,
  error: ({ message }) => `Error: ${message}\n`
})

module.exports = (ipc) => 
  async function build(cmd) {
    const { json } = cmd.flags
    const link = cmd.args.link
    const { drive }  = plink.parse(link)
    if (!drive.key) throw ERR_INVALID_INPUT(`Link "${link}" is not a valid key`)
    const { dir = os.cwd() } = cmd.args
    await output(json, pearBuild({ link, dir }))
  }
