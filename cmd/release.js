'use strict'
const os = require('bare-os')
const { isAbsolute, resolve } = require('bare-path')
const { outputter, ansi } = require('pear-terminal')
const { ERR_INVALID_INPUT } = require('pear-errors')
const plink = require('pear-link')

const output = outputter('release', {
  releasing: ({ name, link }) => `\n${ansi.pear} Releasing ${name} [ ${link} ]\n`,
  'updating-to': ({ releaseLength, currentLength }) =>
    `Current length is ${currentLength}\nSetting release to ${releaseLength}\n`,
  released: ({ name, link, length }) =>
    `The ${name} app (${link}) was successfully released.\nLatest length: ${length}\n`,
  error: ({ code, stack }) => `Releasing Error (code: ${code || 'none'}) ${stack}`,
  final: ({ reason = 'Release complete\n', success = true } = {}) => ({
    output: 'print',
    message: `${reason}`,
    success
  })
})

module.exports = async function release(cmd) {
  const ipc = global.Pear[global.Pear.constructor.IPC]
  const { checkout, name, json } = cmd.flags
  const link = cmd.args.link
  if (!link || plink.parse(link).drive.key === null) {
    throw ERR_INVALID_INPUT('A valid pear link must be specified.')
  }
  let dir = cmd.args.dir || os.cwd()
  if (isAbsolute(dir) === false) dir = resolve(os.cwd(), dir)
  if (checkout !== undefined && Number.isInteger(+checkout) === false) {
    throw ERR_INVALID_INPUT('--checkout flag must supply an integer if set')
  }
  const id = Bare.pid
  await output(
    json,
    ipc.release({
      id,
      name,
      link,
      checkout,
      dir,
      cmdArgs: Bare.argv.slice(1)
    })
  )
}
