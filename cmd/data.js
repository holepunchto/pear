'use strict'
const hypercoreid = require('hypercore-id-encoding')
const plink = require('pear-link')
const { outputter, ansi, byteSize } = require('pear-terminal')

const padding = '    '
const placeholder = '[ No results ]\n'

class Data {
  static output = outputter('data', {
    final: (result, { tag }) => {
      switch (tag) {
        case 'apps':
          return Data.apps(result.data)
        case 'dht':
          return Data.dht(result.nodes)
        case 'multisig':
          return Data.multisig(result.records)
        case 'gc':
          return Data.gc(result.records)
        case 'manifest':
          return Data.manifest(result.manifest)
        case 'assets':
          return Data.assets(result.assets)
        case 'currents':
          return Data.currents(result.records)
        case 'presets':
          return Data.presets(result.presets)
        default:
          throw new Error(`Unknown output tag: ${tag}`)
      }
    }
  })

  static apps = (bundles) => {
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

  static dht = (nodes) => {
    if (!nodes.length) return placeholder
    let out = ''
    for (const node of nodes) {
      out += `${node.host}${ansi.dim(`:${node.port}`)}\n`
    }
    return out
  }

  static multisig = (records) => {
    if (!records.length) return placeholder
    let out = ''
    for (const record of records) {
      out += `- ${ansi.bold(hypercoreid.encode(record.targetKey))}\n`
    }
    return out
  }

  static gc = (records) => {
    if (!records.length) return placeholder
    let out = ''
    for (const gc of records) {
      out += `- ${ansi.bold(gc.path)}\n`
    }
    return out
  }

  static manifest = (manifest) => {
    if (!manifest) return placeholder
    return `version: ${ansi.bold(manifest.version)}\n`
  }

  static assets = (assets) => {
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

  static currents = (records) => {
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

  static presets = (presets) => {
    let out = ''
    if (presets) {
      out += `${presets.flags}\n`
    } else {
      out += `[ none ]\n`
    }
    return out
  }
  constructor(cmd) {
    this.cmd = cmd
    this.ipc = global.Pear[global.Pear.constructor.IPC]
    this.json = cmd.command.parent.flags.json
  }

  async apps() {
    const { cmd } = this
    const { command } = cmd
    const { secrets } = command.parent.flags
    const link = command.args.link
    if (link) plink.parse(link) // validates
    await Data.output(
      this.json,
      this.ipc.data({ resource: 'apps', secrets, link }),
      { tag: 'apps' },
      this.ipc
    )
  }

  async dht() {
    await Data.output(this.json, this.ipc.data({ resource: 'dht' }), { tag: 'dht' })
  }

  async multisig() {
    await Data.output(this.json, this.ipc.data({ resource: 'multisig' }), { tag: 'multisig' })
  }

  async gc() {
    await Data.output(this.json, this.ipc.data({ resource: 'gc' }), { tag: 'gc' })
  }

  async manifest() {
    await Data.output(this.json, this.ipc.data({ resource: 'manifest' }), { tag: 'manifest' })
  }

  async assets() {
    const { cmd } = this
    const { command } = cmd
    const link = command.args.link
    if (link) plink.parse(link) // validates
    await Data.output(this.json, this.ipc.data({ resource: 'assets', link }), { tag: 'assets' })
  }

  async currents() {
    const { cmd } = this
    const { command } = cmd
    const link = command.args.link
    if (link) plink.parse(link) // validates
    await Data.output(this.json, this.ipc.data({ resource: 'currents', link }), { tag: 'currents' })
  }

  async presets() {
    const { cmd } = this
    const command = cmd.args.command
    const link = cmd.args.link
    await Data.output(this.json, this.ipc.presets({ command, link }), { tag: 'presets' })
  }
}

module.exports = (cmd) => new Data(cmd)[cmd.command.name]()
