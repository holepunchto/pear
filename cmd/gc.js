'use strict'
const { outputter } = require('pear-api/terminal')

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

  async #op (cmd, data = null) {
    const { command } = cmd
    const { json } = command.parent.flags
    const stream = this.ipc.gc({ resource: command.name, data }, this.ipc)
    await output(json, stream)
  }

  releases (cmd) {
    return this.#op(cmd)
  }

  async sidecars (cmd) {
    return this.#op(cmd, { pid: Bare.pid })
  }

  async interfaces (cmd) {
    return this.#op(cmd, { age: cmd.flags.age })
  }
}
