'use strict'
const { permit, isTTY } = require('./iface')


module.exports = (ipc) => async function run (cmd, devrun = false) {
  try {
    const { detached, store } = cmd.flags

    if (devrun && !cmd.args.link) {
      cmd.args.link = '.'
      Bare.argv.push('.')
    }

    const cmdArgs = cmd.command.argv
    const args = cmdArgs.slice(1)
    const appArgs = cmd.rest || []
    await require('../run')({ flags: cmd.flags, link: cmd.args.link, appArgs, ipc, args, cmdArgs, storage: store, detached })
  } catch (err) {
    if (err.code === 'ERR_PERMISSION_REQUIRED' && cmd.flags.ask && isTTY) {
      await permit(ipc, err.info, 'run')
    } else {
      throw err
    }
  }
}
