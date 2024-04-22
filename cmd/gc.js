'use strict'
const { print, outputter } = require('./iface')
const parse = require('../lib/parse')

const output = outputter('gc', {
  retrieving: ({ name, flag }) => `Retrieving ${name} ${flag} processes...`,
  complete: ({ killed }) => { return killed.length > 0 ? `Killed sidecars with pid: ${killed}` : 'No running sidecars' },
  error: ({ code, stack }) => `GC Error (code: ${code || 'none'}) ${stack}`
})

module.exports = (ipc) => async function gc (args) {
  try {
    const flags = parse.args(args, {
      boolean: ['json']
    })
    const { _, json } = flags
    const [cmd] = _
    await output(json, ipc.gc({ pid: Bare.pid, cmd }))
  } catch (err) {
    ipc.userData.usage.output('gc', false)
    print(err.message, false)
    Bare.exit(1)
  } finally {
    await ipc.close()
  }
}
