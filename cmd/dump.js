'use strict'
const { isAbsolute, resolve } = require('bare-path')
const { outputter, permit, ansi, isTTY, byteSize, byteDiff } = require('pear-terminal')

const output = outputter('dump', {
  dumping: ({ link, dir }) =>
    dir === '-' ? `${ansi.pear} Output ${link}` : `\n${ansi.pear} Dump ${link} into ${dir}`,
  file: ({ key, value }) => `${key}${value ? '\n' + value : ''}`,
  complete: ({ dryRun }) => {
    return dryRun ? '\nDumping dry run complete\n' : '\nDumping complete\n'
  },
  stats({ upload, download, peers }) {
    const dl =
      download.bytes + download.speed === 0
        ? ''
        : `[${ansi.down} ${byteSize(download.bytes)} - ${byteSize(download.speed)}/s ] `
    const ul =
      upload.bytes + upload.speed === 0
        ? ''
        : `[${ansi.up} ${byteSize(upload.bytes)} - ${byteSize(upload.speed)}/s ] `
    return {
      output: 'status',
      message: `[ Peers: ${peers} ] ${dl}${ul}`
    }
  },
  error: (err, info, ipc) => {
    if (err.info && err.info.encrypted && info.ask && isTTY) {
      return permit(ipc, err.info, 'dump')
    }
    if (err.code === 'ERR_DIR_NONEMPTY') {
      return 'Dir is not empty. To overwrite: --force'
    }
    return `Dumping Error (code: ${err.code || 'none'}) ${err.stack}`
  },
  ['byte-diff']: byteDiff
})

module.exports = async function dump(cmd) {
  const ipc = global.Pear[global.Pear.constructor.IPC]
  const { dryRun, checkout, json, only, force, ask, prune, list } = cmd.flags
  const { link } = cmd.args
  let { dir } = cmd.args
  dir = dir === '-' ? '-' : isAbsolute(dir) ? dir : resolve('.', dir)
  await output(
    json,
    ipc.dump({
      id: Bare.pid,
      link,
      dir,
      dryRun,
      checkout,
      only,
      force,
      prune,
      list
    }),
    { ask },
    ipc
  )
}
