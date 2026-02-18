'use strict'
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
  const json = cmd.flags.json
  await output({ json, ctrlTTY: false, log: (line) => console.log(line) }, ipc.touch({}))
}
