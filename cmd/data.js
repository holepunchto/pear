'use strict'
const parseLink = require('../lib/parse-link')
const { outputter } = require('./iface')
const { ERR_INVALID_INPUT } = require('../errors')

const appsOutput = (bundles) => {
  let out = ''
  for (const bundle of bundles) {
    out += `- link: ${bundle.link}\n`
    out += `  appStorage: ${bundle.appStorage}\n`
    out += `  encryptionKey: ${bundle.encryptionKey.toString('hex')}\n`
    out += `  tags: ${bundle.tags}\n\n`
  }
  return out
}

const dhtOutput = (nodes) => {
  let out = ''
  for (const node of nodes) {
    out += `${node.host}:${node.port}\n`
  }
  return out
}

const output = outputter('data', {
  apps: (data) => appsOutput(data),
  link: (data) => appsOutput([data]),
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
    const link = command.args.link
    if (link) {
      const parsed = parseLink(link)
      if (!parsed) throw ERR_INVALID_INPUT(`Link "${link}" is not a valid key`)
      const result = await this.ipc.data({ resource: 'link', link })
      await output(json, result, { tag: 'link' }, this.ipc)
    } else {
      const result = await this.ipc.data({ resource: 'apps' })
      await output(json, result, { tag: 'apps' }, this.ipc)
    }
  }

  async dht (cmd) {
    const { command } = cmd
    const { json } = command.parent.flags
    const result = await this.ipc.data({ resource: 'dht' })
    await output(json, result, { tag: 'dht' }, this.ipc)
  }
}
