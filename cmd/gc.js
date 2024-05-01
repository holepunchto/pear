'use strict'
const { print, outputter, InputError } = require('./iface')
const parse = require('../lib/parse')

const output = outputter('gc', {
  remove: ({ resource, id }) => `Removed ${resource} '${id}'`,
  complete: ({ resource, count }) => {
    return count > 0 ? `Total ${resource}s removed: ${count}` : `No ${resource}s removed`
  },
  error: ({ code, message, stack }) => `GC Error (code: ${code || 'none'}) ${message} ${stack}`
})

module.exports = (ipc) => async function gc (args) {
  try {
    const flags = parse.args(args, {
      boolean: ['json']
    })
    const { _, json } = flags
    const [resource] = _
    if (!resource) throw new InputError('A <cmd> must be specified.')
    if (resource !== 'release' && resource !== 'sidecar') throw new InputError(`Resource '${resource}' is not valid`)
    const stream = ipc.gc({ pid: Bare.pid, resource }, ipc)
    await output(json, stream)
  } catch (err) {
    if (err instanceof InputError || err.code === 'ERR_INVALID_FLAG') {
      print(err.message, false)
      ipc.userData.usage.output('gc')
    } else {
      print('An error occured', false)
    }
    Bare.exit(1)
  } finally {
    await ipc.close()
  }
}
