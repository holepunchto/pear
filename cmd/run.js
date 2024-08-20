'use strict'
const { outputter, trust, stdio, password } = require('./iface')

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
    if (err.code === 'ERR_PERMISSION_REQUIRED' && cmd.flags.ask) {
      if (!err.info.isEncrypted) {
        const explain = 'Be sure that software is trusted before running it\n' +
          '\nType "TRUST" to allow execution or anything else to exit\n\n'
        const act = 'Use pear run again to execute trusted application\n'
        const ask = 'Trust application'
        await trust({ ipc, key: err.info.key, message: err.message, explain, act, ask })
      } else {
        await password({ ipc, key: err.info.key })
      }
    } else {
      throw err
    }
  }
}
