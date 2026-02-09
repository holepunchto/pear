'use strict'
const plink = require('pear-link')
const { outputter, confirm, ansi } = require('pear-terminal')
const { ERR_INVALID_INPUT } = require('pear-errors')

const output = outputter('gc', {
  remove: ({ resource, id, operation = 'removed' }) =>
    `${operation[0].toUpperCase() + operation.slice(1)} ${resource.slice(0, -1)} '${id}'`,
  complete: ({ resource, count }) => {
    return count > 0 ? `Total ${resource} removed: ${count}` : `No ${resource} removed`
  },
  error: ({ code, message, stack }) => `GC Error (code: ${code || 'none'}) ${message} ${stack}`
})

module.exports = async function gc(cmd) {
  const ipc = global.Pear[global.Pear.constructor.IPC]
  const { command } = cmd
  const { json } = command.parent.flags
  const gc = new GC()
  const data = (await gc[command.name](cmd)) ?? null
  const stream = ipc.gc({ resource: command.name, data }, ipc)
  await output(json, stream)
}

class GC {
  releases() {
    return null
  }

  sidecars() {
    return { pid: Bare.pid }
  }

  async assets(cmd) {
    const { command } = cmd
    const link = command.args.link
    if (link) {
      const parsed = plink.parse(link)
      if (!parsed) throw ERR_INVALID_INPUT(`Link "${link}" is not a valid key`)
    }
    const dialog =
      ansi.warning +
      `  ${ansi.bold('WARNING')} synced assets will be cleared from disk. To confirm type "CLEAR"\n\n`
    const target = link || 'all assets'
    const ask = `Clear ${target}`
    const delim = '?'
    const validation = (v) => v === 'CLEAR'
    const msg = '\n' + ansi.cross + ' type uppercase CLEAR to confirm\n'
    await confirm(dialog, ask, delim, validation, msg)
    return { link }
  }

  cores() {
    return null
  }
}
