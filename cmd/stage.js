'use strict'
const os = require('bare-os')
const { isAbsolute, resolve } = require('bare-path')
const { outputter, ansi, print, InputError } = require('./iface')
const parse = require('../lib/parse')

const output = outputter('stage', {
  staging: ({ name, channel, key, current, release, data }) => {
    return `\n🍐 Staging ${name} into ${channel}\n${data ? '[ DATA ONLY ]' : ''}\n[ ${ansi.dim(key)} ]\n\nCurrent version is ${current} with release set to ${release}\n`
  },
  dry: 'NOTE: This is a dry run, no changes will be persisted.\n',
  complete: ({ dryRun }) => { return dryRun ? '\nStaging dry run complete!\n' : '\nStaging complete!\n' },
  error: ({ code, stack }) => `Staging Error (code: ${code || 'none'}) ${stack}`,
  addendum: ({ version, release, channel, key, data }) => `${data ? '[ DATA ONLY ]' : ''}Latest version is now ${version} with release set to ${release}\n\nUse \`pear release ${channel}\` to set release to latest version\n\n[ ${ansi.dim(key)} ]\n`,
})

module.exports = (ipc) => async function stage (args) {
  try {
    const { _, 'dry-run': dryRun, data, json, ignore, name } = parse.args(args, {
      boolean: ['data', 'json'],
      string: ['ignore', 'name'],
      alias: { 'dry-run': 'd' }
    })
    const [from] = _
    let [, dir = ''] = _

    const isKey = from && parse.runkey(from.toString()).key !== null
    const channel = isKey ? null : from
    const key = isKey ? from : null
    if (!channel && !key) throw new InputError('A key or the channel name must be specified.')
    if (isAbsolute(dir) === false) dir = dir ? resolve(os.cwd(), dir) : os.cwd()
    const id = Bare.pid
    await output(json, ipc.stage({ id, channel, key, dir, dryRun, data, ignore, name, clientArgv: Bare.argv }))
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
