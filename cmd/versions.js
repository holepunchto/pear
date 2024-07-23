'use strict'
const { outputter, ansi } = require('./iface')
const { dependencies } = require('../package.json')

const output = outputter('versions', {
  header (str) { return `${str}\n` },
  v ({ name, version }) { return `${ansi.bold(name)}: ${version}` },
  vs (arr) { return arr.map(([name, version]) => this.v({ name, version })).join(' | ') },
  json (data) { return JSON.stringify(data, 0, 2) },
  newline () { return '' }
})

module.exports = (ipc) => async function versions (cmd) {
  const json = cmd.flags.json
  const { runtimes, platform } = await ipc.versions()
  const { pear, bare, electron } = runtimes
  const version = ~~(platform.fork) + '.' + (platform.length || 'dev') + '.' + platform.key
  await output(false, out({ json, platform: version, pear, bare, electron, header: cmd.command.header }))
}

async function * out ({ json, platform, pear, bare, electron, header }) {
  const bareVersions = { ...Bare.versions }
  if (bareVersions.bare !== bare) bareVersions.bare = bare + ' (sidecar) / ' + bareVersions.bare
  if (json) {
    yield { tag: 'json', data: { platform, pear, electron, ...bareVersions, ...dependencies } }
    return
  }
  yield { tag: 'header', data: header }
  yield { tag: 'v', data: { name: 'pear', version: platform + ' / ' + pear } }
  yield { tag: 'vs', data: Object.entries(bareVersions) }
  yield { tag: 'v', data: { name: 'electron', version: electron } }
  yield { tag: 'newline' }
  for (const [name, version] of Object.entries(dependencies)) yield { tag: 'v', data: { name, version } }
  yield { tag: 'newline' }
}
