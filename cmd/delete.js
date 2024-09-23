'use strict'
const { outputter } = require('./iface')
const parseLink = require('../lib/parse-link')

const output = outputter('delete', {
  success: (_, { header, key }) => {
    return `${header}\n\nCleared ${key}\n`
  },
  error: ({ message }) => {
    return `Error: ${message}\n`
  }
})

module.exports = (ipc) => async function del (cmd) {
  const json = cmd.flags.json
  const { drive } = parseLink(cmd.args.key)
  const clearAppStorage = cmd.flags.clearAppStorage
  const { key } = drive
  await output(json, ipc.delete({ key, clearAppStorage }), { header: cmd.command.header, key: cmd.args.key })
}
