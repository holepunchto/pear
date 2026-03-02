'use strict'
const plink = require('pear-link')
const { outputter, ansi, byteSize } = require('pear-terminal')

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
  let totalBytes = 0
  let out = ''
  for (const asset of assets) {
    out += `- ${ansi.bold(asset.link)}\n`
    out += `${padding}ns: ${ansi.dim(asset.ns)}\n`
    out += `${padding}path: ${ansi.dim(asset.path)}\n`
    out += `${padding}name: ${ansi.dim(asset.name)}\n`
    out += `${padding}only: ${ansi.dim(asset.only)}\n`
    out += `${padding}bytes: ${ansi.dim(byteSize(asset.bytes || 0))}\n`
    out += '\n'
    totalBytes += asset.bytes || 0
  }
  out += `\n${ansi.bold('Total assets: ')}${ansi.dim(byteSize(totalBytes))}\n`
  return out
}

const currentsOutput = (records) => {
  if (!records.length) return placeholder
  let out = ''
  for (const record of records) {
    out += `- ${ansi.bold(record.link)}\n`
    out += `${padding}fork: ${ansi.dim(record.checkout.fork)}\n`
    out += `${padding}length: ${ansi.dim(record.checkout.length)}\n`
    out += '\n'
  }
  return out
}

const presetsOutput = (presets) => {
  let out = ''
  if (presets) {
    out += `${presets.flags}\n`
  } else {
    out += `[ none ]\n`
  }
  return out
}

const output = outputter('data', {
  final: (result, { tag }) => {
    switch (tag) {
      case 'apps':
        return appsOutput(result.data)
      case 'dht':
        return dhtOutput(result.nodes)
      case 'gc':
        return gcOutput(result.records)
      case 'manifest':
        return manifestOutput(result.manifest)
      case 'assets':
        return assetsOutput(result.assets)
      case 'currents':
        return currentsOutput(result.records)
      case 'presets':
        return presetsOutput(result.presets)
      default:
        throw new Error(`Unknown output tag: ${tag}`)
    }
  }
})

module.exports = (cmd, sub) => new Data(cmd)[sub]()

class Data {
  constructor(cmd) {
    this.cmd = cmd
    this.ipc = global.Pear[global.Pear.constructor.IPC]
  }

  async apps() {
    const { cmd } = this
    const { command } = cmd
    const { secrets, json } = command.parent.flags
    const link = command.args.link
    if (link) plink.parse(link) // validates
    await output(
      json,
      this.ipc.data({ resource: 'apps', secrets, link }),
      { tag: 'apps' },
      this.ipc
    )
  }

  async dht() {
    const { cmd } = this
    const { command } = cmd
    const { json } = command.parent.flags
    await output(json, this.ipc.data({ resource: 'dht' }), { tag: 'dht' }, this.ipc)
  }

  async gc() {
    const { cmd } = this
    const { command } = cmd
    const { json } = command.parent.flags
    await output(json, this.ipc.data({ resource: 'gc' }), { tag: 'gc' }, this.ipc)
  }

  async manifest() {
    const { cmd } = this
    const { command } = cmd
    const { json } = command.parent.flags
    await output(json, this.ipc.data({ resource: 'manifest' }), { tag: 'manifest' }, this.ipc)
  }

  async assets() {
    const { cmd } = this
    const { command } = cmd
    const { json } = command.parent.flags
    const link = command.args.link
    if (link) plink.parse(link) // validates
    await output(json, this.ipc.data({ resource: 'assets', link }), { tag: 'assets' }, this.ipc)
  }

  async currents() {
    const { cmd } = this
    const { command } = cmd
    const { json } = command.parent.flags
    const link = command.args.link
    if (link) plink.parse(link) // validates
    await output(json, this.ipc.data({ resource: 'currents', link }), { tag: 'currents' }, this.ipc)
  }

  async presets() {
    const { cmd } = this
    const command = cmd.args.command
    const link = cmd.args.link
    const { json } = cmd.command.parent.flags
    await output(json, this.ipc.presets({ command, link }), { tag: 'presets' }, this.ipc)
  }
}
