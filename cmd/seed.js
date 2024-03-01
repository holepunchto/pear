'use strict'
const os = require('bare-os')
const { readFile } = require('bare-fs/promises')
const { join } = require('bare-path')
const parse = require('../lib/parse')
const { outputter, print, ansi, InputError } = require('./iface')

const output = outputter('seed', {
  seeding: ({ key, name, channel }) => `\n${ansi.pear} Seeding: ${key || `${name} [ ${channel} ]`}\n   ${ansi.dim('ctrl^c to stop & exit')}\n`,
  key: (info) => `-o-:-\n    pear://${info}\n...`,
  'content-key': (info) => `Content core key (hex) :-\n\n    ${info}\n`,
  'meta-key': (info) => `Meta discovery key (hex) :-\n\n    ${info}\n`,
  'meta-discovery-key': (info) => `Meta core discovery key (hex) :-\n\n    ${info}\n`,
  announced: '^_^ announced',
  'peer-add': (info) => `o-o peer join ${info}`,
  'peer-remove': (info) => `-_- peer drop ${info}`
})

module.exports = (rpc) => async function seed (args) {
  const parsed = parse.args(args, {
    boolean: ['verbose', 'json'],
    string: ['seeders', 'name'],
    alias: { verbose: 'v' }
  })
  const { _, json, verbose, seeders } = parsed
  try {
    const [from, dir = os.cwd()] = _
    const isKey = parse.runkey(from.toString()).key !== null
    const channel = isKey ? null : from
    const key = isKey ? from : null
    let { name } = parsed
    if (!name && !key) {
      const pkg = JSON.parse(await readFile(join(dir, 'package.json')))
      name = pkg.pear?.name || pkg.name
    }
    const id = Bare.pid
    await output(json, rpc.seed({ id, name, channel, key, verbose, seeders, dir, clientArgv: Bare.argv }))
  } catch (err) {
    if (err instanceof InputError || err.code === 'ERR_INVALID_FLAG') {
      if (json) {
        print(JSON.stringify({ cmd: 'seed', type: 'error', message: err.message, stack: err.stack, code: err.code }))
      } else {
        print(err.message, false)
        await rpc.usage.output('seed')
      }
    } else {
      print('An error occured', false)
      console.error(err)
    }
    Bare.exit(1)
  }
}
