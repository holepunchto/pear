'use strict'
const parseLink = require('../lib/parse-link')
const { outputter, ansi } = require('./iface')
const { ERR_INVALID_INPUT } = require('../errors')

const appsOutput = (bundles, showSecrets) => {
  let out = ''
  for (const bundle of bundles) {
    out += `- ${ansi.bold(bundle.link)}\n`
    out += `      appStorage: ${ansi.dim(bundle.appStorage)}\n`
    if (showSecrets && bundle.encryptionKey) {
      out += `      encryptionKey: ${ansi.dim(bundle.encryptionKey.toString('hex'))}\n`
    }
    if (bundle.tags) out += `      tags: ${ansi.dim(bundle.tags)}\n`
    out += '\n'
  }
  return out
}

const dhtOutput = (nodes) => {
  let out = ''
  for (const node of nodes) {
    out += `${node.host}${ansi.dim(`:${node.port}`)}\n`
  }
  return out
}

const output = outputter('data', {
  apps: (data, options) => appsOutput(data, options.showSecrets),
  link: (data, options) => appsOutput([data], options.showSecrets),
  dht: (data) => dhtOutput(data)
})

module.exports = (ipc) => new Data(ipc)

class Data {
  constructor (ipc) {
    this.ipc = ipc
  }

  async apps (cmd) {
    const { command } = cmd
    const { showSecrets, json } = command.parent.flags
    const link = command.args.link
    if (link) {
      const parsed = parseLink(link)
      if (!parsed) throw ERR_INVALID_INPUT(`Link "${link}" is not a valid key`)
      const result = await this.ipc.data({ resource: 'link', link })
      await output(json, result, { tag: 'link', showSecrets }, this.ipc)
    } else {
      const result = await this.ipc.data({ resource: 'apps' })
      await output(json, result, { tag: 'apps', showSecrets }, this.ipc)
    }
  }

  async dht (cmd) {
    const { command } = cmd
    const { json } = command.parent.flags
    const result = await this.ipc.data({ resource: 'dht' })
    await output(json, result, { tag: 'dht' }, this.ipc)
  }
}
