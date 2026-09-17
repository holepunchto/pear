'use strict'
const context = require('../context')
const { outputter, hint } = require('../lib/terminal.js')

const output = outputter('identity', {
  final: ({ publicKey }) => ({
    output: 'print',
    success: Infinity, // omit success ansi tick
    message: publicKey
  })
})

module.exports = async function identity(cmd) {
  const ipc = context.getIPC()
  const json = cmd.command.parent.flags.json
  const stream = ipc.identity({ type: cmd.command.name })

  const final = await output({ json, ctrlTTY: false, log: (line) => console.log(line) }, stream)

  if (!json && cmd.command.name === 'blind-peer-client') {
    hint('Use the key above as a trusted peer for your blind peer', [
      `pear blind-peer start --trusted-peer=${final.publicKey}`
    ])
  }
}
