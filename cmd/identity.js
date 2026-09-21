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

  if (!json && cmd.command.name === 'blind-relay') {
    hint('Use the key above as a blind relay for your swarm', [
      `pear --relay ${final.publicKey} seed <link>`
    ])
  }

  if (!json && cmd.command.name === 'seed') {
    hint('Use the key above to wait until this peer has synced', [
      `pear seed --until-sync=${final.publicKey} <link>`
    ])
  }

  if (!json && cmd.command.name === 'blind-peer') {
    hint('Use the key above as a blind peer for seeding', [
      `pear seed --blind-peer=${final.publicKey} <link>`
    ])
  }
}
