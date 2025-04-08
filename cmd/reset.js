'use strict'
const { outputter, confirm, ansi } = require('./iface')
const os = require('bare-os')
const path = require('bare-path')
const { ERR_ASSERTION } = require('../errors')

const output = outputter('reset', {
  reseting: ({ link }) => `\nReseting storage of application ${link}`,
  preset: ({ link }) => `\nReseting storage of application ${link}`,
  complete: () => 'Reset Complete\n',
  error: ({ code, stack }) => {
    return `Reset Error (code: ${code || 'none'}) ${stack}`
  }
})

module.exports = (ipc) => async function reset (cmd) {
  const { json } = cmd.flags
  const link = cmd.args.link
  const isPresetReset = cmd.command.name === 'presets'
  const isPear = link.startsWith('pear://')

  let dialog
  let ask

  switch (cmd.command.name) {
    case 'app':
      dialog = ansi.warning + `  ${ansi.bold('WARNING')} the storage of ${ansi.bold(link)} will be permanently deleted and cannot be recovered. To confirm type "RESET"\n\n`
      ask = `Reset ${link} storage`
      break
    case 'presets':
      dialog = ansi.warning + `  ${ansi.bold('WARNING')} the default configuration of ${ansi.bold(link)} will be deleted. To confirm type "RESET"\n\n`
      ask = `Reset ${link} default configuration`
      break
    default:
      throw ERR_ASSERTION(`reset command ${cmd.command.name} not implemented`)
  }

  const delim = '?'
  const validation = (value) => value === 'RESET'
  const msg = '\n' + ansi.cross + ' uppercase RESET to confirm\n'
  await confirm(dialog, ask, delim, validation, msg)

  await output(json, ipc.reset({ link: isPear || path.isAbsolute(link) ? link : path.join(os.cwd(), link), preset: isPresetReset }))
}
