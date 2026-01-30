'use strict'
const plink = require('pear-link')
const { outputter } = require('pear-terminal')
const { ERR_INVALID_INPUT } = require('pear-errors')
const { permit, isTTY } = require('pear-terminal')

const output = outputter('changelog', {
  changelog: ({ changelog, index, max }) =>
    (index > 0 ? '\n____________\n\n' : '') +
    changelog +
    (index === max - 1 ? '\n' : ''),
  error: (err, info, ipc) => {
    if (err.info && err.info.encrypted && info.ask && isTTY) {
      return permit(ipc, err.info, 'info')
    } else {
      return `Info Error (code: ${err.code || 'none'}) ${err.stack}`
    }
  },
  final(data) {
    return data.success ? {} : false
  }
})

module.exports = async function changelog(cmd) {
  const ipc = global.Pear[global.Pear.constructor.IPC]
  const { json, full, max = 10 } = cmd.flags
  const isKey = cmd.args.link && plink.parse(cmd.args.link).drive.key !== null
  const channel = isKey ? null : cmd.args.link
  const link = isKey ? cmd.args.link : null
  if (link && isKey === false) {
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
      channel,
      changelog: { max: nmax, semver: cmd.flags.of, full },
      cmdArgs: Bare.argv.slice(1)
    }),
    { ask: cmd.flags.ask },
    ipc
  )
}
