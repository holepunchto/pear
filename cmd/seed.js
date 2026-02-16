'use strict'
const os = require('bare-os')
const { readFile } = require('bare-fs/promises')
const { join } = require('bare-path')
const plink = require('pear-link')
const { ERR_INVALID_INPUT } = require('pear-errors')
const { outputter, ansi, permit, isTTY } = require('pear-terminal')

const output = outputter('seed', {
  seeding: ({ key, name }) =>
    `\n${ansi.pear} Seeding: ${key || name}\n   ${ansi.dim('ctrl^c to stop & exit')}\n`,
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

module.exports = async function seed(cmd) {
  const ipc = global.Pear[global.Pear.constructor.IPC]
  const { json, verbose, ask } = cmd.flags
  const { dir = os.cwd() } = cmd.args
  const link = cmd.args.link
  const isKey = link && plink.parse(link).drive.key !== null
  if (!isKey) throw ERR_INVALID_INPUT('A valid pear link must be specified.')
  let { name } = cmd.flags
  if (!name) {
    const pkg = JSON.parse(await readFile(join(dir, 'package.json')))
    name = pkg.pear?.name || pkg.name
  }
  const id = Bare.pid

  await output(
    json,
    ipc.seed({
      id,
      name,
      link,
      verbose,
      dir,
      cmdArgs: Bare.argv.slice(1)
    }),
    { ask },
    ipc
  )
}
