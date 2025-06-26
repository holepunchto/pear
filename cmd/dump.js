'use strict'
const { ERR_INVALID_INPUT } = require('../errors')
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

function getFileNameFromPearUrl(url) {
    if (url.startsWith('pear://')) {
        const urlParts = url.slice(7).split('/')
        const path = urlParts.slice(1).join('/')
        if (path) {
            const pathParts = path.split('/')
            return pathParts[pathParts.length - 1]
        } else {
            return null;
        }
    } else {
        return null;
    }
}

module.exports = (ipc) => async function dump (cmd) {
  const { dryRun, checkout, json, ask, force } = cmd.flags
  const { link } = cmd.args

  let { dir } = cmd.args
  if (!link) throw ERR_INVALID_INPUT('<link> must be specified.')
  if (!dir) throw ERR_INVALID_INPUT('<dir> must be specified.')
  if (dir === '-') {
      dir = '-'
  } else if (getFileNameFromPearUrl(link)) {
      dir = '-'
  }
  else {
      dir = isAbsolute(dir) ? dir : resolve('.', dir);
  }

  await output(json, ipc.dump({ id: Bare.pid, link, dir, dryRun, checkout, force }), { ask }, ipc)
}
