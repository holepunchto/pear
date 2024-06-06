'use strict'
const crypto = require('hypercore-crypto')
const hypercoreid = require('hypercore-id-encoding')
const { ERR_INVALID_INPUT } = require('../errors')
const { outputter } = require('./iface')

const output = outputter('encryption-key', {
  removed: ({ name }) => `Encryption key "${name}" removed`,
  added: ({ name }) => `Encryption key "${name}" added`,
  generated: ({ key }) => `Encryption key:\n\n${key}\n`
})

module.exports = (ipc) => new EncryptionKey(ipc)

class EncryptionKey {
  constructor (ipc) {
    this.ipc = ipc
  }

  async generate () {
    await output(false, [
      { tag: 'generated', data: { key: hypercoreid.encode(crypto.randomBytes(32)) } },
      { tag: 'final', data: { success: true } }
    ])
  }

  async add (cmd) {
    const { name, secret } = cmd.args
    try { hypercoreid.decode(secret) } catch { throw ERR_INVALID_INPUT('Invalid encryption key') }
    const stream = this.ipc.encryptionKey({ pid: Bare.pid, action: 'add', name, secret }, this.ipc)
    await output(false, stream)
  }

  async remove (cmd) {
    const { name } = cmd.args
    const stream = this.ipc.encryptionKey({ pid: Bare.pid, action: 'remove', name }, this.ipc)
    await output(false, stream)
  }
}
