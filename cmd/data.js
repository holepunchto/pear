'use strict'
const plink = require('pear-api/link')
const { outputter, ansi } = require('pear-api/terminal')
const { ERR_INVALID_INPUT } = require('pear-api/errors')
const byteSize = require('tiny-byte-size')

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

const manifestOutput = (manifest) => {
  if (!manifest) return placeholder
  return `version: ${ansi.bold(manifest.version)}\n`
}

const assetsOutput = (assets) => {
  if (!assets.length) return placeholder
  let totalAllocated = 0
  let out = ''
  for (const asset of assets) {
    out += `- ${ansi.bold(asset.link)}\n`
    out += `${padding}path: ${ansi.dim(asset.path)}\n`
    if (asset.bytesAllocated) {
      out += `${padding}bytesAllocated: ${ansi.dim(asset.bytesAllocated)} (${byteSize(asset.bytesAllocated)} MB)\n`
      totalAllocated += asset.bytesAllocated
    }
    out += `\n${ansi.bold('Total')}: ${byteSize(totalAllocated)} MB\n`
  }
  return out
}

const output = outputter('data', {
  apps: (result) => appsOutput(result),
  dht: (result) => dhtOutput(result),
  gc: (result) => gcOutput(result),
  manifest: (result) => manifestOutput(result),
  assets: (result) => assetsOutput(result)
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
      const parsed = plink.parse(link)
      if (!parsed) throw ERR_INVALID_INPUT(`Link "${link}" is not a valid key`)
    }
    await output(json, this.ipc.data({ resource: 'apps', secrets, link }), { tag: 'apps' }, this.ipc)
  }

  async dht (cmd) {
    const { command } = cmd
    const { json } = command.parent.flags
    await output(json, this.ipc.data({ resource: 'dht' }), { tag: 'dht' }, this.ipc)
  }

  async gc (cmd) {
    const { command } = cmd
    const { json } = command.parent.flags
    await output(json, this.ipc.data({ resource: 'gc' }), { tag: 'gc' }, this.ipc)
  }

  async manifest (cmd) {
    const { command } = cmd
    const { json } = command.parent.flags
    await output(json, this.ipc.data({ resource: 'manifest' }), { tag: 'manifest' }, this.ipc)
  }

  async assets (cmd) {
    const { command } = cmd
    const { json } = command.parent.flags
    const link = command.args.link
    if (link) {
      const parsed = plink.parse(link)
      if (!parsed) throw ERR_INVALID_INPUT(`Link "${link}" is not a valid key`)
    }
    await output(json, this.ipc.data({ resource: 'assets', link }), { tag: 'assets' }, this.ipc)
  }
}
