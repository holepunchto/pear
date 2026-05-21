'use strict'
const context = require('../context')
const { outputter } = require('pear-terminal')

const output = outputter('gc', {
  remove: ({ resource, id, operation = 'removed' }) =>
    `${operation[0].toUpperCase() + operation.slice(1)} ${resource.slice(0, -1)} '${id}'`,
  complete: ({ resource, count }) => {
    return count > 0 ? `Total ${resource} removed: ${count}` : `No ${resource} removed`
  },
  error: ({ code, message, stack }) => `GC Error (code: ${code || 'none'}) ${message} ${stack}`
})

module.exports = async function gc(cmd) {
  const ipc = context.getIPC()
  const { command } = cmd
  const { json } = command.parent.flags
  const gc = new GC()
  const data = (await gc[command.name](cmd)) ?? null
  const stream = ipc.gc({ resource: command.name, data }, ipc)
  await output(json, stream)
}

class GC {
  sidecars() {
    return { pid: Bare.pid }
  }

  cores() {
    return null
  }
}
