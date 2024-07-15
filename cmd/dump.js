'use strict'
const { ERR_INVALID_INPUT } = require('../errors')
const { isAbsolute, resolve } = require('bare-path')
const { outputter } = require('./iface')
const output = outputter('stage', {
  dumping: ({ link, dir, list }) => list ? '' : `\n🍐 Dumping ${link} into ${dir}`,
  file: ({ key, value }) => `${key}${value ? '\n' + value : ''}`,
  complete: '\nDumping complete!\n',
  error: ({ code, stack }) => `Dumping Error (code: ${code || 'none'}) ${stack}`
})

module.exports = (ipc) => async function dump (cmd) {
  const { checkout, list, json } = cmd.flags
  const { link } = cmd.args
  let { dir } = cmd.args
  if (!link) throw ERR_INVALID_INPUT('<link> must be specified.')
  if (!dir) throw ERR_INVALID_INPUT('<dir> must be specified.')
  dir = dir === '-' ? '-' : (isAbsolute(dir) ? dir : resolve('.', dir))
  if (list && Number.isNaN(Number(list))) {
    throw ERR_INVALID_INPUT('--list must be a number')
  }
  await output(json, ipc.dump({ id: Bare.pid, link, dir, list, checkout }))
}
