'use strict'
const context = require('../context')
const { outputter } = require('../lib/terminal.js')

const output = outputter('identity', {
  final: ({ publicKey }) => ({
    output: 'print',
    success: Infinity, // omit success ansi tick
    message: publicKey
  })
})

module.exports = async function identity(cmd) {
  const ipc = context.getIPC()
  const json = cmd.command.flags.json
  const stream = ipc.identity({ type: cmd.command.name })

  await output({ json, ctrlTTY: false, log: (line) => console.log(line) }, stream)
}
