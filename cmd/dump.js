'use strict'
const { ERR_INVALID_INPUT } = require('pear-api/errors')
const { isAbsolute, resolve } = require('bare-path')
const { outputter, permit, isTTY } = require('./iface')

const output = outputter('stage', {
  dumping: ({ link, dir, list }) => list > -1 ? '' : `\n🍐 Dumping ${link} into ${dir}`,
  file: ({ key, value }) => `${key}${value ? '\n' + value : ''}`,
  complete: ({ dryRun }) => { return dryRun ? '\nDumping dry run complete!\n' : '\nDumping complete!\n' },
  error: (err, info, ipc) => {
    if (err.info && err.info.encrypted && info.ask && isTTY) {
      return permit(ipc, err.info, 'dump')
    }
    if (err.code === 'ERR_DIR_NONEMPTY') {
      return 'Dir is not empty. To overwrite: --force'
    }
    return `Dumping Error (code: ${err.code || 'none'}) ${err.stack}`
  }
})

module.exports = (ipc) => async function dump (cmd) {
  const { dryRun, checkout, json, encryptionKey, ask, force } = cmd.flags
  const { link } = cmd.args
  let { dir } = cmd.args
  if (!link) throw ERR_INVALID_INPUT('<link> must be specified.')
  if (!dir) throw ERR_INVALID_INPUT('<dir> must be specified.')
  dir = dir === '-' ? '-' : (isAbsolute(dir) ? dir : resolve('.', dir))
  await output(json, ipc.dump({ id: Bare.pid, link, dir, dryRun, checkout, encryptionKey, force }), { ask }, ipc)
}
