'use strict'
const { outputter } = require('./iface')

const output = outputter('encryption-key', {
  removed: ({ name }) => `Encryption key "${name}" removed`,
  added: ({ name }) => `Encryption key "${name}" added`
})

module.exports = (ipc) => new EncryptionKey(ipc)

class EncryptionKey {
  constructor (ipc) {
    this.ipc = ipc
  }
  async add (cmd) {
    const { name, secret } = cmd.args
    const stream = this.ipc.encryptionKey({ pid: Bare.pid, action: 'add', name, secret }, this.ipc)
    await output(false, stream)
  }
  async remove (cmd) {
    const { name } = cmd.args
    const stream = this.ipc.encryptionKey({ pid: Bare.pid, action: 'remove', name }, this.ipc)
    await output(false, stream)
  }
}
