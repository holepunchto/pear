'use strict'
const { outputter, ansi } = require('pear-api/terminal')
const { randomBytes } = require('hypercore-crypto')
const os = require('bare-os')

const output = outputter('touch', {
  result: ({ key }, { header, channel }) => {
    return `${header}\n\n${ansi.bold(channel)}\n${key}\n`
  },
  error: ({ message }) => {
    return `Error: ${message}\n`
  }
})

module.exports = (ipc) => async function touch (cmd) {
  const dir = os.cwd()
  const json = cmd.flags.json
  const channel = cmd.args.channel || randomBytes(16).toString('hex')
  await output(json, ipc.touch({ dir, channel }), { channel, header: cmd.command.header })
}
