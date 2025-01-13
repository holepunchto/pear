'use strict'
const parseLink = require('../lib/parse-link')
const { outputter, isTTY, permit } = require('./iface')
const { ERR_INVALID_INPUT } = require('../errors')

const appsOut = (items) => {
  let out = 'INSTALLED APPS\n'
  for (const bundle of items) {
    out += `- link: ${bundle.link}\n`
    out += `    appStorage: ${bundle.appStorage}\n`
    out += `    encryptionKey: ${bundle.encryptionKey}\n`
    out += `    tags: ${bundle.tags}\n`
  }
  return out
}

const linkOut = (items) => {
  let out = 'PEAR LINK\n'
  for (const bundle of items) {
    out += `- link: ${bundle.link}\n`
    out += `    appStorage: ${bundle.appStorage}\n`
    out += `    encryptionKey: ${bundle.encryptionKey}\n`
    out += `    tags: ${bundle.tags}\n`
  }
  return out
}

const dhtOut = (items) => {
  let out = 'DHT NODES\n'
  for (const node of items.nodes) {
    out += `- ${node.host}:${node.port}\n`
  }
  return out
}

const output = outputter('data', {
  apps: (res) => appsOut(res),
  link: (res) => linkOut(res),
  dht: (res) => dhtOut(res),
  error: (err, info, ipc) => {
    if (err.info && err.info.encrypted && info.ask && isTTY) {
      return permit(ipc, err.info, 'data')
    }
    return `Data Error (code: ${err.code || 'none'}) ${err.stack}`
  },
  final: () => false
})

module.exports = (ipc) => new Data(ipc)

class Data {
  constructor (ipc) {
    this.ipc = ipc
  }

  async apps (cmd) {
    const { command } = cmd
    const { json } = command.parent.flags
    const result = await this.ipc.data({ pid: Bare.pid, resource: 'apps' })
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
    const result = await this.ipc.data({ pid: Bare.pid, resource: 'link', link })
    await output(json, result, { tag: 'link' }, this.ipc)
  }

  async dht (cmd) {
    const { command } = cmd
    const { json } = command.parent.flags
    const result = await this.ipc.data({ pid: Bare.pid, resource: 'dht' })
    await output(json, result, { tag: 'dht' }, this.ipc)
  }
}
