'use strict'
const { outputter } = require('./iface')
const { ERR_INVALID_INPUT } = require('../lib/errors')

const output = outputter('gc', {
  remove: ({ resource, id }) => `Removed ${resource} '${id}'`,
  complete: ({ resource, count }) => { return count > 0 ? `Total ${resource}s removed: ${count}` : `No ${resource}s removed` },
  error: ({ code, message, stack }) => `GC Error (code: ${code || 'none'}) ${message} ${stack}`
})

module.exports = (ipc) => async function gc (cmd) {
  const { json } = cmd.flags
  const { resource } = cmd.args
  if (!resource) throw new ERR_INVALID_INPUT('A <resource> must be specified.')
  if (resource !== 'release' && resource !== 'sidecar') throw new ERR_INVALID_INPUT(`Resource '${resource}' is not valid for gc`)
  const stream = ipc.gc({ pid: Bare.pid, resource }, ipc)
  await output(json, stream)
}
