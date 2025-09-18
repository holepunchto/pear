'use strict'
const os = require('bare-os')
const { outputter, ansi } = require('pear-terminal')

const output = outputter('build', {
  init: ({ dir }) => `\n${ansi.pear} Building at ${dir}\n`,
  npm: () => 'Installing npm packages...\n',
  generate: () => 'Generating project...\n',
  build: () => 'Building project...\n',
  complete: ({ dir }) => `\n${ansi.tick} Build complete: ${dir}\n`
})

module.exports = (ipc) => async function build (cmd) {
  const { json } = cmd.flags
  const link = cmd.args.link
  const { dir = os.cwd() } = cmd.args
  await output(json, ipc.build({ link, dir }), ipc)
}
