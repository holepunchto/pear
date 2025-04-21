'use strict'
const { permit, isTTY } = require('pear-api/terminal')

module.exports = (ipc) => async function run (cmd, devrun = false) {
  try {
    const appDataStream = (await ipc.data({ resource: 'link', link: cmd.args.link }))
    const { data } = await new Promise((resolve) => appDataStream.on('data', resolve))
    const preset = data?.preset?.run ? JSON.parse(data?.preset?.run) : null

    const flags = cmd.flags
    if (preset) {
      for (const [key] of Object.entries(flags)) {
        if (cmd.indices.flags[key] !== null && cmd.indices.flags[key] !== undefined) continue // manual flags override preset flags
        if (key === 'detached' && flags.detach) continue // avoids recursive --detach flag
        flags[key] = preset[key]
      }
    }

    const { detached, store } = flags

    if (devrun && !cmd.args.link) {
      cmd.args.link = '.'
      Bare.argv.push('.')
    }

    const cmdArgs = cmd.command.argv
    const args = cmdArgs.slice(1)
    const appArgs = cmd.rest || []
    await require('../run')({ flags: cmd.flags, link: cmd.args.link, appArgs, ipc, args, cmdArgs, storage: store, detached })
    await require('../run')({ flags, link: cmd.args.link, indices: cmd.indices, appArgs, ipc, args, cmdArgs, storage: store, detached })
  } catch (err) {
    if (err.code === 'ERR_PERMISSION_REQUIRED' && cmd.flags.ask && isTTY) {
      await permit(ipc, err.info, 'run')
    } else {
      throw err
    }
  }
}
