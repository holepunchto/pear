'use strict'
const context = require('../context')
const { isAbsolute, resolve } = require('bare-path')
const { outputter, ansi, byteSize, byteDiff } = require('../lib/terminal.js')

const output = outputter('dump', {
  dumping: ({ link, dir }) =>
    dir === '-'
      ? `${ansi.pear} Output ${ansi.green(link)}`
      : `\n${ansi.pear} Dump ${ansi.green(link)} into ${ansi.gray(dir)}`,
  file: ({ key, value }) => `${key}${value ? '\n' + value : ''}`,
  complete: ({ dryRun }) => {
    return '\n' + ansi.green(dryRun ? 'Dumping dry run complete' : 'Dumping complete') + '\n'
  },
  stats({ upload, download, peers }) {
    const dl =
      download.bytes + download.speed === 0
        ? ''
        : `[ ${ansi.down} ${ansi.green(byteSize(download.bytes))} - ${ansi.green(`${byteSize(download.speed)}/s`)} ] `
    const ul =
      upload.bytes + upload.speed === 0
        ? ''
        : `[ ${ansi.up} ${ansi.green(byteSize(upload.bytes))} - ${ansi.green(`${byteSize(upload.speed)}/s`)} ] `
    return {
      output: 'status',
      message: `[ Peers ${ansi.green(peers)} ]  ${dl}${ul}`
    }
  },
  error: (err) => {
    if (err.code === 'ERR_DIR_NONEMPTY') {
      return 'Dir is not empty. To overwrite: --force'
    }
    return `Dumping Error (code: ${err.code || 'none'}) ${err.stack}`
  },
  ['byte-diff']: byteDiff
})

module.exports = async function dump(cmd) {
  const ipc = context.getIPC()
  const { dryRun, checkout, json, only, force, prune, list } = cmd.flags
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
    })
  )
}
