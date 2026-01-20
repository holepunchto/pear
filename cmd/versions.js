'use strict'
const plink = require('pear-link')
const { outputter, ansi } = require('pear-terminal')
const { dependencies } = require('../package.json')

function v(name, version) {
  return `${ansi.bold(name)}: ${version}`
}
function vs(data, delim = ' | ') {
  return Object.entries(data)
    .map(([name, version]) => v(name, version))
    .join(delim)
}

const output = outputter('versions', {
  platform({ checkout }, info) {
    try {
      info.verlink = plink.serialize({ drive: checkout })
    } catch (e) {
      // localdev
      info.verlink = 'pear://dev/' + checkout.key
    }
    return `${info.header}\n`
  },
  runtimes: (versions, info) => {
    info.bare = versions.bare
    info.pear = versions.pear
    return false
  },
  libraries: (versions, info) => {
    return {
      output: 'print',
      message:
        vs({ pear: info.pear, bare: info.bare, ...versions }) +
        '\n\n' +
        v('link', info.verlink) +
        '\n'
    }
  },
  modules: (versions, info) => {
    return info.modules
      ? vs(versions, '\n') + '\n'
      : `Use ${ansi.dim(ansi.bold('--modules|-m'))} flag for module versions\n`
  }
})

module.exports = async function versions(cmd) {
  const ipc = global.Pear[global.Pear.constructor.IPC]
  const json = cmd.flags.json
  const modules = cmd.flags.modules
  const { runtimes, platform } = await ipc.versions()
  const header = cmd.command.header
  const { bare, ...libs } =
    Bare.versions.bare !== runtimes.bare
      ? {
          ...Bare.versions,
          bare: runtimes.bare + ' (sidecar) / ' + Bare.versions.bare
        }
      : Bare.versions
  await output(
    json,
    [
      { tag: 'platform', data: { checkout: platform } },
      { tag: 'runtimes', data: { pear: runtimes.pear, bare } },
      { tag: 'libraries', data: libs },
      { tag: 'modules', data: dependencies }
    ],
    { modules, header }
  )
}
