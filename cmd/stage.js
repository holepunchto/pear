'use strict'
const os = require('bare-os')
const { isAbsolute, resolve } = require('bare-path')
const { outputter, ansi, print, InputError } = require('./iface')
const parse = require('../lib/parse')

let blocks = 0
let total = 0
const output = outputter('stage', {
  staging: ({ name, channel, key, current, release }) => {
    return `\n${ansi.pear} Staging ${name} into ${channel}\n\n[ ${ansi.dim(key)} ]\n\nCurrent version is ${current} with release set to ${release}\n`
  },
  skipping: ({ reason }) => 'Skipping warmup (' + reason + ')',
  dry: 'NOTE: This is a dry run, no changes will be persisted.\n',
  complete: ({ dryRun }) => { return dryRun ? '\nStaging dry run complete!\n' : '\nStaging complete!\n' },
  warming: (data) => {
    blocks = data.blocks || blocks
    total = data.total || total
    const message = (data.success ? 'Warmed' : 'Warming') + ' up app (used ' + blocks + '/' + total + ' blocks) ' // Adding a space as a hack for an issue with the outputter which duplicates the last char on done
    return { output: 'status', message }
  },
  error: ({ code, stack }) => `Staging Error (code: ${code || 'none'}) ${stack}`,
  addendum: ({ version, release, channel, key }) => `Latest version is now ${version} with release set to ${release}\n\nUse \`pear release ${channel}\` to set release to latest version\n\n[ ${ansi.dim(key)} ]\n`
})

module.exports = (ipc) => async function stage (args) {
  try {
    const { _, dryRun, bare, json, ignore, name } = parse.args(args, {
      boolean: ['dryRun', 'bare', 'json'],
      string: ['ignore', 'name'],
      alias: { dryRun: ['d', 'dry-run'], verbose: 'v', bare: 'b' }
    })
    const [from] = _
    let [, dir = ''] = _

    const isKey = from && parse.runkey(from.toString()).key !== null
    const channel = isKey ? null : from
    const key = isKey ? from : null
    if (!channel && !key) throw new InputError('A key or the channel name must be specified.')
    if (isAbsolute(dir) === false) dir = dir ? resolve(os.cwd(), dir) : os.cwd()
    const id = Bare.pid
    await output(json, ipc.stage({ id, channel, key, dir, dryRun, bare, ignore, name, clientArgv: Bare.argv }))
  } catch (err) {
    if (err instanceof InputError || err.code === 'ERR_INVALID_FLAG') {
      print(err.message, false)
      await ipc.usage.output('stage')
    } else {
      print('An error occured', false)
      console.error(err)
    }
    Bare.exit(1)
  }
}
