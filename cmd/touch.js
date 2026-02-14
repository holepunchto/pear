'use strict'
const os = require('bare-os')
const { outputter } = require('pear-terminal')

const output = outputter('touch', {
  final: ({ link }) => {
    return {
      output: 'print',
      success: Infinity, // omit success ansi tick
      message: link
    }
  },
  error: ({ message }) => {
    return `Error: ${message}\n`
  }
})

module.exports = async function touch(cmd) {
  const ipc = global.Pear[global.Pear.constructor.IPC]
  const dir = cmd.flags.dir ? os.cwd() : null
  const json = cmd.flags.json
  await output(json, ipc.touch({ dir }))
}
