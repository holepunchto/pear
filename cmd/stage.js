'use strict'
const os = require('bare-os')
const { isAbsolute, resolve } = require('bare-path')
const { outputter, ansi } = require('./iface')
const parseLink = require('../run/parse-link')
const { ERR_INVALID_INPUT } = require('../lib/errors')

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

module.exports = (ipc) => async function stage (cmd) {
  const { dryRun, bare, json, ignore, name, truncate } = cmd.flags
  const isKey = cmd.args.channel && parseLink(cmd.args.channel).key !== null
  const channel = isKey ? null : cmd.args.channel
  const key = isKey ? cmd.args.channel : null
  if (!channel && !key) throw ERR_INVALID_INPUT('A key or the channel name must be specified.')
  let { dir = os.cwd() } = cmd.args
  if (isAbsolute(dir) === false) dir = dir ? resolve(os.cwd(), dir) : os.cwd()
  const id = Bare.pid
  await output(json, ipc.stage({ id, channel, key, dir, dryRun, bare, ignore, name, truncate, clientArgv: Bare.argv }))
}
