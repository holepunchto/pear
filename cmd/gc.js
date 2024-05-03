'use strict'
const { outputter } = require('./iface')

const output = outputter('gc', {
  remove: ({ resource, id }) => `Removed ${resource} '${id}'`,
  complete: ({ resource, count }) => { return count > 0 ? `Total ${resource}s removed: ${count}` : `No ${resource}s removed` },
  error: ({ code, message, stack }) => `GC Error (code: ${code || 'none'}) ${message} ${stack}`
})

module.exports = (ipc) => {
  return {
    release: async (cmd) => {
      const { command } = cmd
      const { json } = command.parent.flags
      const stream = ipc.gc({ pid: Bare.pid, resource: command.name }, ipc)
      await output(json, stream)
    },
    sidecar: async (cmd) => {
      const { command } = cmd
      const { json } = command.parent.flags
      const stream = ipc.gc({ pid: Bare.pid, resource: command.name }, ipc)
      await output(json, stream)
    }
  }
}
