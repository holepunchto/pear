'use strict'
const parseLink = require('../lib/parse-link')
const { outputter, ansi, confirm, status } = require('./iface')
const { ERR_INVALID_INPUT } = require('../errors')
const { PLATFORM_HYPERDB } = require('../constants')

const padding = '    '
const noResults = '[ No results ]\n'

const appsOutput = (bundles) => {
  if (!bundles?.length) return noResults
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
  if (!nodes?.length) return noResults
  let out = ''
  for (const node of nodes) {
    out += `${node.host}${ansi.dim(`:${node.port}`)}\n`
  }
  return out
}

const gcOutput = (records) => {
  if (!records?.length) return noResults
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

  async reset (cmd) {
    const { command } = cmd
    const { yes } = command.flags

    if (!yes) {
      const dialog = `${ansi.warning} Clearing database ${ansi.bold(PLATFORM_HYPERDB)}\n\n`
      const ask = 'Type DELETE to confirm'
      const delim = '?'
      const validation = (val) => val === 'DELETE'
      const msg = '\n' + ansi.cross + ' uppercase DELETE to confirm\n'
      await confirm(dialog, ask, delim, validation, msg)
    }

    const complete = await pick(this.ipc.dataReset(), (tag) => tag === 'complete')
    complete ? status('Success\n', true) : status('Failure (ipc.dataReset)\n', false)
  }
}

function pick (stream, predicate) {
  return new Promise((resolve, reject) => {
    stream.on('error', reject)
    const listener = ({ tag, data }) => {
      if (!predicate(tag)) return
      resolve(data)
      stream.off('data', listener)
    }
    stream.on('data', listener)
  })
}
