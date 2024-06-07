'use strict'
const { outputter } = require('./iface')

const output = outputter('gc', {
  remove: ({ resource, id }) => `Removed ${resource.slice(0, -1)} '${id}'`,
  complete: ({ resource, count }) => { return count > 0 ? `Total ${resource}s removed: ${count}` : `No ${resource} removed` },
  error: ({ code, message, stack }) => `GC Error (code: ${code || 'none'}) ${message} ${stack}`
})

module.exports = (ipc) => new GC(ipc)

class GC {
  constructor (ipc) {
    this.ipc = ipc
  }

  async releases (cmd) {
    const { command } = cmd
    const { json } = command.parent.flags
    const stream = this.ipc.gc({ pid: Bare.pid, resource: command.name }, this.ipc)
    await output(json, stream)
  }

  async sidecars (cmd) {
    const { command } = cmd
    const { json } = command.parent.flags
    const stream = this.ipc.gc({ pid: Bare.pid, resource: command.name }, this.ipc)
    await output(json, stream)
  }
}
