'use strict'
const plink = require('pear-link')
const context = require('../context')
const { outputter } = require('../lib/terminal.js')
const { ERR_INVALID_INPUT } = require('pear-errors')

const output = outputter('gc', {
  cores: ({ link, skipped }) => {
    if (skipped) {
      return `Skipped clearing writable core ~ ${link}. Use --force to clear it anyway`
    } else {
      return `Cleared core ~ ${link}`
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
