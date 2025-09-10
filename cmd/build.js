'use strict'
const os = require('bare-os')
const { outputter, ansi } = require('pear-terminal')

const output = outputter('build', {
  building: ({ link, dir }) => `\n${ansi.pear} Building: ${link} into ${dir}\n`
})

module.exports = (ipc) => async function build (cmd) {
  const { json } = cmd.flags
  const link = cmd.args.link
  const { dir = os.cwd() } = cmd.args
  await output(json, ipc.build({ link, dir }), ipc)
}
