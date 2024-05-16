'use strict'
const os = require('bare-os')
const { readFile } = require('bare-fs/promises')
const { join } = require('bare-path')
const parseLink = require('../run/parse-link')
const { outputter, ansi } = require('./iface')

const output = outputter('seed', {
  seeding: ({ key, name, channel }) => `\n${ansi.pear} Seeding: ${key || `${name} [ ${channel} ]`}\n   ${ansi.dim('ctrl^c to stop & exit')}\n`,
  key: (info) => `---:\n pear://${info}\n...`,
  'content-key': (info) => `Content core key (hex) :-\n\n    ${info}\n`,
  'meta-key': (info) => `Meta discovery key (hex) :-\n\n    ${info}\n`,
  'meta-discovery-key': (info) => `Meta core discovery key (hex) :-\n\n    ${info}\n`,
  announced: '^_^ announced',
  'peer-add': (info) => `o-o peer join ${info}`,
  'peer-remove': (info) => `-_- peer drop ${info}`
})

module.exports = (ipc) => async function seed (cmd) {
  const { json, verbose, seeders } = cmd.flags
  const { dir = os.cwd() } = cmd.args
  const isKey = parseLink(cmd.args.channel).key !== null
  const channel = isKey ? null : cmd.args.channel
  const link = isKey ? cmd.args.channel : null
  let { name } = cmd.flags
  if (!name && !link) {
    const pkg = JSON.parse(await readFile(join(dir, 'package.json')))
    name = pkg.pear?.name || pkg.name
  }
  const id = Bare.pid
  await output(json, ipc.seed({ id, name, channel, link, verbose, seeders, dir, argv: Bare.argv.slice(1) }))
}
