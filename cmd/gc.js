'use strict'
const context = require('../context')
const { outputter } = require('../lib/terminal.js')
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
  const data = (await gc[command.name](cmd)) ?? null
  const stream = ipc.gc({ resource: command.name, data }, ipc)
  await output(json, stream)
}

class GC {
  cores(cmd) {
    const { command } = cmd
    const link = command.args.link
    if (link) parse(link)
    return { link }
  }
}
