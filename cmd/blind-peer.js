'use strict'
const context = require('../context')
const hypercoreid = require('hypercore-id-encoding')
const { outputter } = require('../lib/terminal.js')
const { ERR_INVALID_INPUT } = require('pear-errors')
const { hint } = require('../lib/terminal')
const { parse } = require('../lib/link')

const output = outputter('blind-peer', {
  listening: ({ publicKey }) => `Blind peer started listening using public key: ${publicKey}`,
  'add-core': ({ announce, key, peerKey }) =>
    `Received add core request for ${key} from peer ${peerKey} (announce: ${announce})`,
  'announce-core': ({ key }) => `Announcing core: ${key}`,
  'gc-start': ({ bytesToClear }) => `GC started, clearing ${bytesToClear} bytes`,
  'gc-done': ({ bytesCleared }) => `GC done, cleared ${bytesCleared} bytes`,
  connecting: ({ peerKey }) => `Connecting to blind peer ${peerKey}`,
  'adding-core': ({ key, announce }) => `Adding core ${key} to blind peer (announce: ${announce})`,
  connected: ({ key }) => `Received connection from blind peer for core ${key}`,
  seeding: ({ key, peerKey, announce }) =>
    `Requested blind peer ${peerKey} to seed core ${key} (announce: ${announce})`,
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
    return data.publicKey
      ? {
          output: 'print',
          success: Infinity,
          message: data.publicKey
        }
      : false
  }
})

module.exports = async function blindPeer(cmd) {
  const ipc = context.getIPC()
  const { json } = cmd.command.parent.flags
  const subcommand = cmd.command.name
  const data = validators[subcommand] ? await validators[subcommand](cmd) : null
  const stream = ipc.blindPeer({ subcommand, data })

  const isIdentity = subcommand === 'identity'
  const log = isIdentity ? (line) => console.log(line) : undefined

  const final = await output({ json, ctrlTTY: !isIdentity, log }, stream)

  if (hinters[subcommand]) hinters[subcommand]({ json, final })
}

const hinters = {
  identity({ json, final }) {
    if (!json) {
      hint('Use the key above as a trusted peer for your blind peer', [
        `pear blind-peer start --trusted-peer=${final.publicKey}`
      ])
    }
    return null
  }
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
