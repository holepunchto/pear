'use strict'
const os = require('bare-os')
const { readFile } = require('bare-fs/promises')
const { join } = require('bare-path')
const parseLink = require('pear-api/parse-link')
const { outputter, ansi, permit, isTTY } = require('./iface')

const output = outputter('seed', {
  seeding: ({ key, name, channel }) => `\n${ansi.pear} Seeding: ${key || `${name} [ ${channel} ]`}\n   ${ansi.dim('ctrl^c to stop & exit')}\n`,
  key: (info) => `---:\n pear://${info}\n...`,
  'content-key': (info) => `Content core key (hex) :-\n\n    ${info}\n`,
  'meta-key': (info) => `Meta discovery key (hex) :-\n\n    ${info}\n`,
  'meta-discovery-key': (info) => `Meta core discovery key (hex) :-\n\n    ${info}\n`,
  announced: '^_^ announced',
  'peer-add': (info) => `o-o peer join ${info}`,
  'peer-remove': (info) => `-_- peer drop ${info}`,
  error: (err, info, ipc) => {
    if (err.info && err.info.encrypted && info.ask && isTTY) {
      return permit(ipc, err.info, 'seed')
    } else {
      return `Seed Error (code: ${err.code || 'none'}) ${err.stack}`
    }
  }
})

module.exports = (ipc) => async function seed (cmd) {
  const { json, verbose, seeders, ask } = cmd.flags
  const { dir = os.cwd() } = cmd.args
  const isKey = parseLink(cmd.args.channel).drive.key !== null
  const channel = isKey ? null : cmd.args.channel
  const link = isKey ? cmd.args.channel : null
  let { name, encryptionKey } = cmd.flags
  if (!name && !link) {
    const pkg = JSON.parse(await readFile(join(dir, 'package.json')))
    name = pkg.pear?.name || pkg.name
  }
  const id = Bare.pid

  await output(json, ipc.seed({ id, name, channel, link, verbose, seeders, dir, encryptionKey, cmdArgs: Bare.argv.slice(1) }), { ask }, ipc)
}
