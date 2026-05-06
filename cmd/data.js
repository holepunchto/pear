'use strict'
const hypercoreid = require('hypercore-id-encoding')
const plink = require('pear-link')
const { outputter, ansi } = require('pear-terminal')

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
    let out = '\n'
    for (const node of nodes) {
      out += `${node.host}${ansi.dim(`:${node.port}`)}\n`
    }
    return out
  }

  static multisig = (records) => {
    if (!records.length) return placeholder
    let out = '\n'
    for (const record of records) {
      out += `- ${ansi.bold(hypercoreid.encode(record.key))}\n`
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

  async presets() {
    const { cmd } = this
    const command = cmd.args.command
    const link = cmd.args.link
    await Data.output(this.json, this.ipc.presets({ command, link }), { tag: 'presets' })
  }
}

module.exports = (cmd) => new Data(cmd)[cmd.command.name]()
