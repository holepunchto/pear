'use strict'
const context = require('../context')
const { outputter } = require('../lib/terminal.js')

const output = outputter('list', {
  core: ({ id, link, open }) => `${open ? '●' : '○'} ${link || `discovery key: ${id}`}`,
  final: ({ count, open }) => ({
    output: 'print',
    success: Infinity, // omit success ansi tick
    message:
      count > 0 ? `Total cores: ${count} | Open: ${open} | Closed: ${count - open}` : 'No cores'
  }),
  error: ({ code, message, stack }) => `List Error (code: ${code || 'none'}) ${message} ${stack}`
})

module.exports = async function list(cmd) {
  const ipc = context.getIPC()
  const json = cmd.flags.json
  await output({ json, ctrlTTY: false, log: (line) => console.log(line) }, ipc.list({}))
}
