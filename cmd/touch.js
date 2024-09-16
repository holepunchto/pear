'use strict'
const { outputter, ansi } = require('./iface')
const { randomBytes } = require('hypercore-crypto')
const os = require('bare-os')

const output = outputter('touch', {
  header (str) { return `${str}\n` },
  channel (channel) { return `${ansi.bold(channel)}:` },
  key (key) { return `${key}` },
  json (data) { return JSON.stringify(data, 0, 2) },
  newline () { return '' }
})

module.exports = (ipc) => async function touch (cmd) {
  const dir = os.cwd()
  const json = cmd.flags.json
  const channel = cmd.args.channel || randomBytes(16).toString('hex')
  const key = await ipc.touch({ dir, channel })
  await output(false, out({ json, channel, key, header: cmd.command.header }))
}

async function * out ({ json, channel, key, header }) {
  if (json) {
    yield { tag: 'json', data: { channel, key } }
    return
  }
  yield { tag: 'header', data: header }
  yield { tag: 'channel', data: channel }
  yield { tag: 'key', data: key }
  yield { tag: 'newline' }
}
