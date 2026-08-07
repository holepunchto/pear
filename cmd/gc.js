'use strict'
const plink = require('pear-link')
const { ERR_INVALID_INPUT } = require('pear-errors')
const context = require('../context')
const { outputter } = require('../lib/terminal.js')

const output = outputter('gc', {
  cores: ({ link, skipped, content }) => {
    if (skipped) {
      return `Skipped clearing core ~ ${link}. The core is writable or does not exist in the corestore`
    } else {
      return `Cleared core ~ ${link}\nCleared content core ~ ${content}`
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

    if (link) {
      let parsed = null
      try {
        parsed = plink.parse(link)
      } catch {
        throw ERR_INVALID_INPUT(`Link "${link}" is not a valid key`)
      }
      if (parsed.drive.key === null) {
        throw ERR_INVALID_INPUT(`Link "${link}" is not a valid key`)
      }
    } else {
      throw ERR_INVALID_INPUT('A link must be specified')
    }

    return { link }
  }
}
