'use strict'
const context = require('../context')
const { outputter } = require('../lib/terminal.js')

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
  const ipc = context.getIPC()
  const json = cmd.flags.json
  await output({ json, ctrlTTY: false, log: (line) => console.log(line) }, ipc.touch({}))
}
