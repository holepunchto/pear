'use strict'
const { outputter } = require('./iface')
const { ERR_INVALID_INPUT } = require('../lib/errors')

const output = outputter('gc', {
  kill: ({ pid }) => `Killed sidecar with pid: ${pid}`,
  complete: ({ killed }) => { return killed.length > 0 ? `Total killed sidecars: ${killed.length}` : 'No running sidecars' },
  error: ({ code, message, stack }) => `GC Error (code: ${code || 'none'}) ${message} ${stack}`
})

module.exports = (ipc) => async function gc (cmd) {
  const { json } = cmd.flags
  const { resource } = cmd.args
  if (!resource) throw new ERR_INVALID_INPUT('A <resource> must be specified.')
  if (resource !== 'sidecar') throw new ERR_INVALID_INPUT(`Resource '${resource}' is not valid for gc`)
  const stream = ipc.gc({ pid: Bare.pid, resource }, ipc)
  await output(json, stream)
}
