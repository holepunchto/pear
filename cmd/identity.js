'use strict'
const context = require('../context')
const { outputter } = require('../lib/terminal.js')

const output = outputter('identity', {
  final: ({ publicKey }) => ({
    output: 'print',
    success: Infinity,
    message: publicKey
  })
})

module.exports = async function identity(cmd) {
  const ipc = context.getIPC()
  const stream = ipc.blindPeer({
    subcommand: 'identity',
    data: { type: cmd.command.name }
  })

  await output({ ctrlTTY: false, log: (line) => console.log(line) }, stream)
}
