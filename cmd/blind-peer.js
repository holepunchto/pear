'use strict'
const context = require('../context')
const { outputter } = require('../lib/terminal.js')
const { ERR_INVALID_INPUT } = require('pear-errors')

const output = outputter('blind-peer', {
  listening: ({ publicKey, encryptionPublicKey }) =>
    `Blind peer listening\n  Public key: ${publicKey}\n  Encryption key: ${encryptionPublicKey}`,
  identity: ({ publicKey }) =>
    `To make a request, use the following key as trusted key: ${publicKey}`,
  'add-core': ({ announce }) => `Core added (announce: ${announce})`,
  'announce-core': ({ key }) => `Announcing core: ${key}`,
  'gc-start': ({ bytesToClear }) => `GC started, clearing ${bytesToClear} bytes`,
  'gc-done': ({ bytesCleared }) => `GC done, cleared ${bytesCleared} bytes`,
  seeding: ({ key, peerKey, announce }) =>
    `Requested blind peer ${peerKey} to seed core ${key} (announce: ${announce})`,
  error: ({ code, message, stack }) =>
    `Blind Peer Error (code: ${code || 'none'}) ${message} ${stack}`
})

module.exports = async function blindPeer(cmd) {
  const ipc = context.getIPC()
  const { json } = cmd.command.parent.flags
  const handler = new BlindPeer()
  const data = (await handler[cmd.command.name](cmd)) ?? null
  const stream = ipc.blindPeer({ subcommand: cmd.command.name, data })
  await output(json, stream)
}

class BlindPeer {
  start(cmd) {
    const { command } = cmd
    const trustedPeer = command.flags.trustedPeer
    return { trustedPeer }
  }

  request(cmd) {
    const { command } = cmd
    const key = command.args.key
    const peerKey = command.flags.peer
    if (!key) throw ERR_INVALID_INPUT('A core key must be specified')
    if (!peerKey) throw ERR_INVALID_INPUT('A blind peer key must be specified')
    return { key, peerKey }
  }
}
