'use strict'
const plink = require('pear-link')
const { outputter, confirm, ansi } = require('pear-terminal')
const { ERR_INVALID_INPUT } = require('pear-errors')

const output = outputter('gc', {
  remove: ({ resource, id }) => `Removed ${resource.slice(0, -1)} '${id}'`,
  complete: ({ resource, count }) => { return count > 0 ? `Total ${resource} removed: ${count}` : `No ${resource} removed` },
  error: ({ code, message, stack }) => `GC Error (code: ${code || 'none'}) ${message} ${stack}`
})

module.exports = (ipc) => new GC(ipc)

class GC {
  constructor (ipc) {
    this.ipc = ipc
  }

  async #op (cmd, data = null) {
    const { command } = cmd
    const { json } = command.parent.flags
    const stream = this.ipc.gc({ resource: command.name, data }, this.ipc)
    await output(json, stream)
  }

  releases (cmd) {
    return this.#op(cmd)
  }

  async sidecars (cmd) {
    return this.#op(cmd, { pid: Bare.pid })
  }

  async assets (cmd) {
    const { command } = cmd
    const link = command.args.link
    if (link) {
      const parsed = plink.parse(link)
      if (!parsed) throw ERR_INVALID_INPUT(`Link "${link}" is not a valid key`)
    }
    const dialog = ansi.warning + `  ${ansi.bold('WARNING')} synced assets will be cleared from disk. To confirm type "CLEAR"\n\n`
    const target = link || 'all assets'
    const ask = `Clear ${target}`
    const delim = '?'
    const validation = (v) => v === 'CLEAR'
    const msg = '\n' + ansi.cross + ' type uppercase CLEAR to confirm\n'
    await confirm(dialog, ask, delim, validation, msg)
    return this.#op(cmd, { link })
  }
}
