'use strict'
const context = require('../context')
const { outputter } = require('../lib/terminal.js')

const output = outputter('cores', {
  core: ({ id, link, writable }) => `${link || `discovery key: ${id}`}${writable && ' (writable)'}`,
  final: ({ count, writable }) => ({
    output: 'print',
    success: Infinity, // omit success ansi tick
    message: count > 0 ? `Total cores: ${count} | Writable: ${writable}` : 'No cores'
  }),
  error: ({ code, message, stack }) => `Cores Error (code: ${code || 'none'}) ${message} ${stack}`
})

module.exports = async function cores(cmd) {
  const ipc = context.getIPC()
  const json = cmd.flags.json
  await output({ json, ctrlTTY: false, log: (line) => console.log(line) }, ipc.cores({}))
}
