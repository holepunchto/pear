'use strict'
const context = require('../context')
const { outputter, confirm, ansi } = require('../lib/terminal.js')
const { parse } = require('../lib/link')

const output = outputter('gc', {
  cores: ({ link, skipped, content }) => {
    if (skipped) {
      return `Skipped clearing core ~ ${link}. The core is writable or does not exist in the corestore`
    } else {
      return `Cleared core ~ ${link}${content ? `\nCleared content core ~ ${content}` : ''}`
    }
  },
  error: ({ code, message, stack }) => `GC Error (code: ${code || 'none'}) ${message} ${stack}`
})

module.exports = async function gc(cmd) {
  const ipc = context.getIPC()
  const { command } = cmd
  const { json } = command.parent.flags
  const gc = new GC()
  const data = (await gc[command.name](cmd, { ipc })) ?? null
  const stream = ipc.gc({ resource: command.name, data }, ipc)
  await output(json, stream)
}

class GC {
  async cores(cmd, { ipc }) {
    const { command } = cmd
    const link = command.args.link
    let force = command.flags.force
    if (link) parse(link)
    if (link && !force && (await ipc.isWritable({ link }))) {
      const dialog =
        ansi.warning +
        `  ${ansi.bold('WARNING')} the cores of ${ansi.bold(link)} are writable, clearing them cannot be undone. To confirm type "CLEAR"\n`
      const ask = `Clear ${link} cores`
      const delim = '?'
      const validation = (value) => value === 'CLEAR'
      const msg = '\n' + ansi.cross + ' uppercase CLEAR to confirm\n'
      await confirm(dialog, ask, delim, validation, msg)
      force = true
    }
    return { link, force }
  }
}
