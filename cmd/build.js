'use strict'
const os = require('bare-os')
const { outputter, ansi } = require('pear-terminal')

const output = outputter('build', {
  building: ({ key }) => `\n${ansi.pear} Building: ${key}`
})

module.exports = (ipc) => async function build (cmd) {
  const { json } = cmd.flags
  const link = cmd.args.key
  const { dir = os.cwd() } = cmd.args
  await output(json, ipc.build({ link, dir }), ipc)
}
