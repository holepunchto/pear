'use strict'
const { print, outputter, InputError } = require('./iface')
const parse = require('../lib/parse')

const output = outputter('gc', {
  retrieving: ({ name, flag }) => `Retrieving ${name} ${flag} processes...`,
  kill: ({ pid }) => `Killed sidecar with pid: ${pid}`,
  complete: ({ killed }) => { return killed.length > 0 ? `Total killed sidecars: ${killed.length}` : 'No running sidecars' },
  error: ({ code, stack }) => `GC Error (code: ${code || 'none'}) ${stack}`
})

module.exports = (ipc) => async function gc (args) {
  try {
    const flags = parse.args(args, {
      boolean: ['json']
    })
    const { _, json } = flags
    const [cmd] = _
    if (!cmd) throw new InputError('A <cmd> must be specified.')
    if (cmd !== 'sidecar') throw new InputError(`Command '${cmd}' is not valid`)
    await output(json, ipc.gc({ pid: Bare.pid, cmd }))
  } catch (err) {
    if (err instanceof InputError || err.code === 'ERR_INVALID_FLAG') {
      print(err.message, false)
      ipc.userData.usage.output('gc')
    } else {
      print('An error occured', false)
      console.error(err)
    }
    Bare.exit(1)
  } finally {
    await ipc.close()
  }
}
