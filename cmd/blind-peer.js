'use strict'
const context = require('../context')
const hypercoreid = require('hypercore-id-encoding')
const { outputter } = require('../lib/terminal.js')
const { ERR_INVALID_INPUT } = require('pear-errors')
const { parse } = require('../lib/link')

const output = outputter('blind-peer', {
  listening: ({ publicKey }) => `Blind peer started listening using public key: ${publicKey}`,
  'add-core': ({ announce, key, peerKey }) =>
    `Received add core request for ${key} from peer ${peerKey} (announce: ${announce})`,
  'announce-core': ({ key }) => `Announcing core: ${key}`,
  'gc-start': ({ bytesToClear }) => `GC started, clearing ${bytesToClear} bytes`,
  'gc-done': ({ bytesCleared }) => `GC done, cleared ${bytesCleared} bytes`,
  'adding-core': ({ key, announce }) =>
    `Requesting core ${key} to be added (announce: ${announce})`,
  'added-core': ({ key }) => `Successfully added core ${key}`,
  error: ({ code, message, stack }) =>
    `Blind Peer Error (code: ${code || 'none'}) ${message} ${stack}`,
  'delete-blocked': ({ key, peerKey }) =>
    `Blocked delete request from untrusted peer ${peerKey} for core ${key}`,
  'delete-core': ({ key, peerKey }) => `Received delete request from ${peerKey} for core ${key}`,
  'delete-core-end': ({ key }) => `Deleted core ${key}`,
  'downgrade-announce': ({ peerKey }) =>
    `Downgraded announce for peer ${peerKey} because peer is not trusted`,
  'add-cores-downgrade-announce': ({ peerKey }) =>
    `Downgraded announce for peer ${peerKey} because peer is not trusted`,
  'announced-initial-cores': () => `Announced all initial cores`,
  'core-downloaded': ({ key }) => `Core fully downloaded: ${key}`,
  'core-append': ({ key, length }) => `Core length updated: ${key} (length: ${length})`,
  'core-client-mode-changed': ({ key, isClient }) =>
    `Announced core ${isClient ? 'enabled' : 'disabled'} client mode: ${key}`,
  final: (data) => {
    if (data.subcommand === 'request') {
      return {
        output: 'status',
        success: true,
        message: `Requested blind peer to seed ${data.coreOnly ? 'core' : 'drive'} ${data.key} (announce: ${data.announce})`
      }
    }
    return false
  }
})

module.exports = async function blindPeer(cmd) {
  const ipc = context.getIPC()
  const { json } = cmd.command.parent.flags
  const subcommand = cmd.command.name
  const data = validators[subcommand] ? await validators[subcommand](cmd) : null
  const stream = ipc.blindPeer({ subcommand, data })

  await output({ json }, stream)
}

const validators = {
  start(cmd) {
    const { command } = cmd
    const trustedPeers = command.flags.trustedPeer
    if (trustedPeers) {
      for (const peer of trustedPeers) {
        if (!peer || !hypercoreid.isValid(peer)) {
          throw ERR_INVALID_INPUT('A valid trusted peer key must be specified')
        }
      }
    }
    return { trustedPeers }
  },
  request(cmd) {
    const { command } = cmd
    const key = command.args.key
    const peerKey = command.flags.peer
    const coreOnly = command.flags.coreOnly

    if (!peerKey || !hypercoreid.isValid(peerKey)) {
      throw ERR_INVALID_INPUT('A valid blind peer key must be specified')
    }

    if (!key) {
      throw ERR_INVALID_INPUT(
        coreOnly ? 'A valid core key must be specified' : 'A valid drive key must be specified'
      )
    }

    if (key.startsWith('pear:')) {
      parse(key, coreOnly ? 'core key' : 'drive link')
    } else if (!hypercoreid.isValid(key)) {
      throw ERR_INVALID_INPUT(
        coreOnly ? 'A valid core key must be specified' : 'A valid drive key must be specified'
      )
    }

    return { key, peerKey, coreOnly }
  }
}
