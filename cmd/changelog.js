'use strict'
const { print } = require('./iface')

module.exports = (ipc) => async function changelog (args) {
  try {
    print(await ipc.changelog(args))
    Bare.exit()
  } catch (err) {
    await ipc.usage.output('changelog', false)
    print(err.message, false)
    Bare.exit(1)
  }
}
