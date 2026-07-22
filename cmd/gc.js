'use strict'
const plink = require('pear-link')
const context = require('../context')
const { outputter } = require('../lib/terminal.js')
const { ERR_INVALID_INPUT } = require('pear-errors')

const output = outputter('gc', {
  remove: ({ resource, id, operation = 'removed', link }) =>
    `${id} ${resource.slice(0, -1)} ${operation}${link ? ' ~ ' + link : ''}`,
  complete: ({ resource, count }) => {
    return count > 0 ? `Total ${resource} removed: ${count}` : `No ${resource} removed`
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
  sidecars() {
    return { pid: Bare.pid }
  }

  cores(cmd) {
    const { command } = cmd
    const link = command.args.link

    if (link) {
      const parsed = plink.parse(link)
      if (!parsed) throw ERR_INVALID_INPUT(`Link "${link}" is not a valid key`)
    } else {
      throw ERR_INVALID_INPUT('A link must be specified')
    }

    return { link }
  }
}
