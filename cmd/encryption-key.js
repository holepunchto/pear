'use strict'
const { outputter } = require('./iface')

const output = outputter('encryption-key', {
  removed: ({ name }) => `Encryption key "${name}" removed`,
  added: ({ name }) => `Encryption key "${name}" added`
})

module.exports = (ipc) => {
  return {
    add: async (cmd) => {
      const { name, secret } = cmd.args
      const stream = ipc.encryptionKey({ pid: Bare.pid, action: 'add', name, secret }, ipc)
      await output(json, stream)
    },
    remove: async (cmd) => {
      const { name } = cmd.args
      const stream = ipc.encryptionKey({ pid: Bare.pid, action: 'remove', name }, ipc)
      await output(json, stream)
    }
  }
}
