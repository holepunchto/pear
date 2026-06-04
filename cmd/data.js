'use strict'
const context = require('../context')
const hypercoreid = require('hypercore-id-encoding')
const { outputter, ansi } = require('../lib/terminal.js')

const placeholder = '[ No results ]\n'

class Data {
  static output = outputter('data', {
    final: (result, { tag }) => {
      switch (tag) {
        case 'dht':
          return Data.dht(result.nodes)
        case 'multisig':
          return Data.multisig(result.records)
        default:
          throw new Error(`Unknown output tag: ${tag}`)
      }
    }
  })

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

  constructor(cmd) {
    this.cmd = cmd
    this.ipc = context.getIPC()
    this.json = cmd.command.parent.flags.json
  }

  async dht() {
    await Data.output(this.json, this.ipc.data({ resource: 'dht' }), { tag: 'dht' })
  }

  async multisig() {
    await Data.output(this.json, this.ipc.data({ resource: 'multisig' }), { tag: 'multisig' })
  }
}

module.exports = (cmd) => new Data(cmd)[cmd.command.name]()
