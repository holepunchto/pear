'use strict'
const parseLink = require('../lib/parse-link')
const { outputter, ansi } = require('./iface')
const { ERR_INVALID_INPUT } = require('../errors')

const padding = '    '
const placeholder = '[ No results ]\n'

const appsOutput = (bundles) => {
  if (!bundles.length || !bundles[0]) return placeholder
  let out = ''
  for (const bundle of bundles) {
    out += `- ${ansi.bold(bundle.link)}\n`
    out += `${padding}storage: ${ansi.dim(bundle.appStorage)}\n`
    if (bundle.encryptionKey) {
      out += `${padding}encryptionKey: ${ansi.dim(bundle.encryptionKey.toString('hex'))}\n`
    }
    if (bundle.tags) out += `${padding}tags: ${ansi.dim(bundle.tags)}\n`
    out += '\n'
  }
  return out
}

const dhtOutput = (nodes) => {
  if (!nodes.length) return placeholder
  let out = ''
  for (const node of nodes) {
    out += `${node.host}${ansi.dim(`:${node.port}`)}\n`
  }
  return out
}

const gcOutput = (records) => {
  if (!records.length) return placeholder
  let out = ''
  for (const gc of records) {
    out += `- ${ansi.bold(gc.path)}\n`
  }
  return out
}

const output = outputter('data', {
  apps: (result) => appsOutput(result),
  link: (result) => appsOutput([result]),
  dht: (result) => dhtOutput(result),
  gc: (result) => gcOutput(result)
})

module.exports = (ipc) => new Data(ipc)

class Data {
  constructor (ipc) {
    this.ipc = ipc
  }

  async apps (cmd) {
    const { command } = cmd
    const { secrets, json } = command.parent.flags
    const link = command.args.link
    if (link) {
      const parsed = parseLink(link)
      if (!parsed) throw ERR_INVALID_INPUT(`Link "${link}" is not a valid key`)
      const result = await this.ipc.data({ resource: 'link', secrets, link })
      await output(json, result, { tag: 'link' }, this.ipc)
    } else {
      const result = await this.ipc.data({ resource: 'apps', secrets })
      await output(json, result, { tag: 'apps' }, this.ipc)
    }
  }

  async dht (cmd) {
    const { command } = cmd
    const { json } = command.parent.flags
    const result = await this.ipc.data({ resource: 'dht' })
    await output(json, result, { tag: 'dht' }, this.ipc)
  }

  async gc (cmd) {
    const { command } = cmd
    const { json } = command.parent.flags
    const result = await this.ipc.data({ resource: 'gc' })
    await output(json, result, { tag: 'gc' }, this.ipc)
  }
}
