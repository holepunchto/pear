'use strict'
const context = require('../context')
const plink = require('pear-link')
const { outputter } = require('../lib/terminal.js')
const { ERR_INVALID_INPUT } = require('pear-errors')

const output = outputter('changelog', {
  changelog: ({ changelog, index, max }) =>
    (index > 0 ? '\n____________\n\n' : '') + changelog + (index === max - 1 ? '\n' : ''),
  error: (err, info, ipc) => {
    return `Info Error (code: ${err.code || 'none'}) ${err.stack}`
  },
  final(data) {
    return data.success ? {} : false
  }
})

module.exports = async function changelog(cmd) {
  const ipc = context.getIPC()
  const { json, full, max = 10 } = cmd.flags
  const link = cmd.args.link || null
  if (link && plink.parse(link).drive.key === null) {
    throw ERR_INVALID_INPUT('Link "' + link + '" is not a valid key')
  }
  const nmax = +max
  if (Number.isInteger(nmax) === false) {
    throw ERR_INVALID_INPUT('Changelog maximum must be an integer')
  }

  await output(
    json,
    ipc.info({
      link,
      changelog: { max: nmax, semver: cmd.flags.of, full },
      cmdArgs: Bare.argv.slice(1)
    }),
    { ask: cmd.flags.ask },
    ipc
  )
}
