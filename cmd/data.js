'use strict'
const parseLink = require('../lib/parse-link')
const { outputter } = require('./iface')
const { ERR_INVALID_INPUT } = require('../errors')

const appsOutput = (items) => {
  let out = 'Installed apps:\n'
  for (const bundle of items) {
    out += `- link: ${bundle.link}\n`
    out += `    appStorage: ${bundle.appStorage}\n`
    out += `    encryptionKey: ${bundle.encryptionKey}\n`
    out += `    tags: ${bundle.tags}\n`
  }
  return out
}

const linkOutput = (item) => {
  let out = 'Pear app:\n'
  out += `- link: ${item.link}\n`
  out += `    appStorage: ${item.appStorage}\n`
  out += `    encryptionKey: ${item.encryptionKey}\n`
  out += `    tags: ${item.tags}\n`
  return out
}

const dhtOutput = (items) => {
  let out = 'DHT known-nodes:\n'
  for (const node of items) {
    out += `- ${node.host}:${node.port}\n`
  }
  return out
}

const output = outputter('data', {
  apps: (res) => appsOutput(res),
  link: (res) => linkOutput(res),
  dht: (res) => dhtOutput(res)
})

module.exports = (ipc) => new Data(ipc)

class Data {
  constructor (ipc) {
    this.ipc = ipc
  }

  async apps (cmd) {
    const result = await this.ipc.data({ resource: 'apps' })
    await output(false, result, { tag: 'apps' }, this.ipc)
  }

  async link (cmd) {
    const { command } = cmd
    const link = command.args.link
    const parsed = parseLink(link)
    if (!parsed || !parsed.drive || !parsed.drive.key) {
      throw ERR_INVALID_INPUT(`Link "${link}" is not a valid key`)
    }
    const result = await this.ipc.data({ resource: 'link', link })
    await output(false, result, { tag: 'link' }, this.ipc)
  }

  async dht (cmd) {
    const result = await this.ipc.data({ resource: 'dht' })
    await output(false, result, { tag: 'dht' }, this.ipc)
  }
}
