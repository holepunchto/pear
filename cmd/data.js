'use strict'
const parseLink = require('../lib/parse-link')
const { outputter } = require('./iface')
const { ERR_INVALID_INPUT } = require('../errors')

const appsOutput = (bundles) => {
  let out = 'Installed apps:\n\n'
  for (const bundle of bundles) {
    out += `- link: ${bundle.link}\n`
    out += `    appStorage: ${bundle.appStorage}\n`
    out += `    encryptionKey: ${bundle.encryptionKey}\n`
    out += `    tags: ${bundle.tags}\n`
  }
  return out
}

const linkOutput = (bundle) => {
  let out = 'Pear app:\n\n'
  out += `- link: ${bundle.link}\n`
  out += `    appStorage: ${bundle.appStorage}\n`
  out += `    encryptionKey: ${bundle.encryptionKey}\n`
  out += `    tags: ${bundle.tags}\n`
  return out
}

const dhtOutput = (nodes) => {
  let out = 'DHT known-nodes:\n\n'
  for (const node of nodes) {
    out += `${node.host}:${node.port}\n`
  }
  return out
}

const output = outputter('data', {
  apps: (data) => appsOutput(data),
  link: (data) => linkOutput(data),
  dht: (data) => dhtOutput(data)
})

module.exports = (ipc) => new Data(ipc)

class Data {
  constructor (ipc) {
    this.ipc = ipc
  }

  async apps (cmd) {
    const { command } = cmd
    const { json } = command.parent.flags
    const result = await this.ipc.data({ resource: 'apps' })
    await output(json, result, { tag: 'apps' }, this.ipc)
  }

  async link (cmd) {
    const { command } = cmd
    const { json } = command.parent.flags
    const link = command.args.link
    const parsed = parseLink(link)
    if (!parsed || !parsed.drive || !parsed.drive.key) {
      throw ERR_INVALID_INPUT(`Link "${link}" is not a valid key`)
    }
    const result = await this.ipc.data({ resource: 'link', link })
    await output(json, result, { tag: 'link' }, this.ipc)
  }

  async dht (cmd) {
    const { command } = cmd
    const { json } = command.parent.flags
    const result = await this.ipc.data({ resource: 'dht' })
    await output(json, result, { tag: 'dht' }, this.ipc)
  }
}
