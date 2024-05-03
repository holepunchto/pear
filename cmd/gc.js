'use strict'
const { outputter } = require('./iface')

const output = outputter('gc', {
  remove: ({ resource, id }) => `Removed ${resource} '${id}'`,
  complete: ({ resource, count }) => { return count > 0 ? `Total ${resource}s removed: ${count}` : `No ${resource}s removed` },
  error: ({ code, message, stack }) => `GC Error (code: ${code || 'none'}) ${message} ${stack}`
})

async function release ({ ipc, cmd }) {
  const { json } = cmd.flags
  const stream = ipc.gc({ pid: Bare.pid, resource: cmd.command.name }, ipc)
  await output(json, stream)
}

async function sidecar ({ ipc, cmd }) {
  const { json } = cmd.flags
  const stream = ipc.gc({ pid: Bare.pid, resource: cmd.command.name }, ipc)
  await output(json, stream)
}

module.exports = { release, sidecar }
