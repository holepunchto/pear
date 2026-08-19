'use strict'
const context = require('../context')
const { outputter, confirm, ansi } = require('../lib/terminal.js')
const { parse } = require('../lib/link')
const { ERR_INVALID_INPUT } = require('pear-errors')

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
    const links = command.args.link.startsWith('pear://')
      ? [command.args.link]
      : await ipc.getLinksByName({ name: command.args.link })
    if (!links.length) throw ERR_INVALID_INPUT(`No cores found with name ${command.args.link}`)
    let force = command.flags.force
    links.forEach((link) => parse(link))
    const writables = await Promise.all(links.map((link) => ipc.isWritable({ link })))
    const anyWritable = writables.some(Boolean)
    if (!force && anyWritable) {
      const dialog =
        ansi.warning +
        `  ${ansi.bold('WARNING')} one or more cores of ${ansi.bold(command.args.link)} are writable, clearing them cannot be undone. To confirm type "CLEAR"\n`
      const ask = `Clear ${command.args.link} cores`
      const delim = '?'
      const validation = (value) => value === 'CLEAR'
      const msg = '\n' + ansi.cross + ' uppercase CLEAR to confirm\n'
      await confirm(dialog, ask, delim, validation, msg)
      force = true
    }
    return { links, force }
  }
}
