'use strict'
const { outputter, permit, stdio } = require('./iface')

const output = outputter('run', {
  exit: ({ code }) => Bare.exit(code),
  stdout: (data, { loading }) => loading && !loading.cleared ? loading.clearing.then(() => stdio.out.write(data)) : stdio.out.write(data),
  stderr: (data, { loading }) => loading && !loading.cleared ? loading.clearing.then(() => stdio.err.write(data)) : stdio.err.write(data),
  loaded: (data, { loading }) => loading && loading.clear(data.forceClear || false)
})

module.exports = (ipc) => async function run (cmd, devrun = false) {
  try {
    const { json, detached, store } = cmd.flags

    if (devrun && !cmd.args.link) {
      cmd.args.link = '.'
      Bare.argv.push('.')
    }

    const args = Bare.argv.slice(2)
    const appArgs = cmd.rest || []
    await output(json, await require('../run')({ flags: cmd.flags, link: cmd.args.link, indices: cmd.indices, appArgs, ipc, args, cmdArgs: Bare.argv.slice(1), storage: store, detached }))
  } catch (err) {
    if (err.code !== 'ERR_PERMISSION_REQUIRED') throw err
    await permit({ ipc, key: err.info.key, message: err.message })
  }
}
