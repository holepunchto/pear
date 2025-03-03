'use strict'
const parseLink = require('pear-api/parse-link')
const { outputter, ansi, confirm, status } = require('pear-api/terminal')
const { ERR_INVALID_INPUT } = require('pear-api/errors')
const { PLATFORM_HYPERDB } = require('pear-api/constants')

const padding = '    '
const placeholder = '[ No results ]\n'

const appsOutput = (bundles) => {
  if (!bundles.length) return placeholder
  let out = ''
  for (const bundle of bundles) {
    out += `- ${ansi.bold(bundle.link)}\n`
    out += `${padding}appStorage: ${ansi.dim(bundle.appStorage)}\n`
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
  gc: (result) => gcOutput(result),
  dataReset: () => 'Database cleared'
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
      await output(json, this.ipc.data({ resource: 'link', secrets, link }), { tag: 'link' }, this.ipc)
    } else {
      await output(json, this.ipc.data({ resource: 'apps', secrets }), { tag: 'apps' }, this.ipc)
    }
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

  async reset (cmd) {
    const { command } = cmd
    const { json } = command.parent.flags
    const { yes } = command.flags
    if (!yes) {
      const dialog = `${ansi.warning} Clearing database ${ansi.bold(PLATFORM_HYPERDB)}\n\n`
      const ask = 'Type DELETE to confirm'
      const delim = '?'
      const validation = (val) => val === 'DELETE'
      const msg = '\n' + ansi.cross + ' uppercase DELETE to confirm\n'
      await confirm(dialog, ask, delim, validation, msg)
    }
    await output(json, this.ipc.dataReset(), { tag: 'dataReset' }, this.ipc)
  }
}
