'use strict'
const { outputter } = require('./iface')

const output = outputter('gc', {
  remove: ({ resource, id }) => `Removed ${resource} '${id}'`,
  complete: ({ resource, count }) => { return count > 0 ? `Total ${resource}s removed: ${count}` : `No ${resource}s removed` },
  error: ({ code, message, stack }) => `GC Error (code: ${code || 'none'}) ${message} ${stack}`
})

module.exports = (ipc) => new GC(ipc)

class GC {
  constructor (ipc) {
    this.ipc = ipc
  }
  async release (cmd) {
    const { command } = cmd
    const { json } = command.parent.flags
    const stream = this.ipc.gc({ pid: Bare.pid, resource: command.name }, this.ipc)
    await output(json, stream)
  }
  async sidecar (cmd)  {
    const { command } = cmd
    const { json } = command.parent.flags
    const stream = this.ipc.gc({ pid: Bare.pid, resource: command.name }, this.ipc)
    await output(json, stream)
  }
}
