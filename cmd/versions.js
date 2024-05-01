'use strict'
const { outputter, ansi, usage } = require('./iface')
const { dependencies } = require('../package.json')

const output = outputter('versions', {
  header (str) { return `${str}\n` },
  v ({ name, version }) { return `${ansi.bold(name)}: ${version}` },
  json (data) { return JSON.stringify(data, 0, 2) },
  newline () { return '' }
})

module.exports = () => async function versions (cmd) {
  const json = cmd.flags.json
  await output(false, out({ json, version: usage.version, header: cmd.command.header }))
}

async function * out ({ json, version, header }) {
  if (json) {
    yield { tag: 'json', data: { pear: version, ...Bare.versions, ...dependencies } }
    return
  }
  yield { tag: 'header', data: header }
  yield { tag: 'v', data: { name: 'pear', version } }
  yield { tag: 'newline' }
  for (const [name, version] of Object.entries(Bare.versions)) yield { tag: 'v', data: { name, version } }
  yield { tag: 'newline' }
  for (const [name, version] of Object.entries(dependencies)) yield { tag: 'v', data: { name, version } }
  yield { tag: 'newline' }
}
