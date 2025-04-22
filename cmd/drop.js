'use strict'
const parseLink = require('pear-api/parse-link')
const { outputter, confirm, ansi } = require('pear-api/terminal')
const { ERR_INVALID_INPUT } = require('pear-api/errors')
const os = require('bare-os')
const path = require('bare-path')

const output = outputter('drop', {
  reseting: ({ link }) => `\nReseting storage of application ${link}`,
  complete: () => 'Reset Complete\n',
  error: ({ code, stack }) => {
    return `Reset Error (code: ${code || 'none'}) ${stack}`
  }
})

module.exports = (ipc) => async function drop (cmd) {
  const { json } = cmd.flags
  const link = cmd.args.link
  if (link) {
    const parsed = parseLink(link)
    if (!parsed) throw ERR_INVALID_INPUT(`Link "${link}" is not a valid key`)
  } else {
    throw ERR_INVALID_INPUT('Link is required')
  }
  const isPear = link.startsWith('pear://')

  const dialog = ansi.warning + `  ${ansi.bold('WARNING')} the storage of ${ansi.bold(link)} will be permanently deleted and cannot be recovered. To confirm type "RESET"\n\n`
  const ask = `Reset ${link} storage`
  const delim = '?'
  const validation = (value) => value === 'RESET'
  const msg = '\n' + ansi.cross + ' uppercase RESET to confirm\n'
  await confirm(dialog, ask, delim, validation, msg)

  await output(json, ipc.drop({ link: isPear || path.isAbsolute(link) ? link : path.join(os.cwd(), link) }))
}
