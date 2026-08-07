'use strict'
const context = require('../context')
const { outputter } = require('../lib/terminal.js')

const output = outputter('cores', {
  core: ({ link, writable, length }) =>
    `${link} ${writable ? `(length: ${length}, writable)` : `(length: ${length})`}`,
  final: ({ count, writable }) => ({
    output: 'print',
    success: Infinity, // omit success ansi tick
    message: count > 0 ? `Total cores: ${count} | Writable: ${writable}` : 'No cores'
  }),
  error: ({ code, message, stack }) => `Error (code: ${code || 'none'}) ${message} ${stack}`
})

module.exports = async function cores(cmd) {
  const ipc = context.getIPC()
  const json = cmd.flags.json
  const allCores = cmd.flags.allCores
  await output({ json, ctrlTTY: false, log: (line) => console.log(line) }, ipc.cores({ allCores }))
}
