'use strict'
const os = require('bare-os')
const { isAbsolute, resolve } = require('bare-path')
const { outputter, ansi } = require('./iface')
const { ERR_INVALID_INPUT } = require('pear-api/errors')
const parseLink = require('pear-api/parse-link')

const output = outputter('release', {
  releasing: ({ name, channel, link }) => `\n${ansi.pear} Releasing ${name} [ ${channel || link} ]\n`,
  'updating-to': ({ releaseLength, currentLength }) => `Current length is ${currentLength}\nSetting release to ${releaseLength}\n`,
  released: ({ name, channel, length }) => `The ${name} app (${channel} channel) was successfully released.\nLatest length: ${length}\n`,
  error: ({ code, stack }) => `Releasing Error (code: ${code || 'none'}) ${stack}`,
  final: ({ reason = 'Release complete\n', success = true } = {}) => ({ output: 'print', message: `${reason}`, success })
})

module.exports = (ipc) => async function release (cmd) {
  const { checkout, name, json } = cmd.flags
  const isKey = parseLink(cmd.args.channel).drive.key !== null
  const channel = isKey ? null : cmd.args.channel
  const link = isKey ? cmd.args.channel : null
  if (!channel && !link) throw ERR_INVALID_INPUT('A valid pear link or the channel name must be specified.')
  let dir = cmd.args.dir || os.cwd()
  if (isAbsolute(dir) === false) dir = resolve(os.cwd(), dir)
  if (checkout !== undefined && Number.isInteger(+checkout) === false) {
    throw ERR_INVALID_INPUT('--checkout flag must supply an integer if set')
  }
  const id = Bare.pid
  await output(json, ipc.release({ id, name, channel, link, checkout, dir, cmdArgs: Bare.argv.slice(1) }))
}
