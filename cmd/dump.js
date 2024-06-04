'use strict'
const os = require('bare-os')
const { isAbsolute, resolve } = require('bare-path')
const { outputter } = require('./iface')
const { ERR_INVALID_INPUT } = require('../errors')
const output = outputter('stage', {
  dumping: ({ key, dir }) => `\n🍐 Dumping ${key} into ${dir}`,
  complete: '\nDumping complete!\n',
  error: ({ code, stack }) => `Dumping Error (code: ${code || 'none'}) ${stack}`
})

module.exports = (ipc) => async function dump (cmd) {
  const { checkout, json } = cmd.flags
  const { link, dir = os.cwd() } = cmd.args
  if (!dir) throw ERR_INVALID_INPUT('Output dir must be specified.')
  if (!link) throw ERR_INVALID_INPUT('The pear link must be specified.')
  await output(json, ipc.dump({ id: Bare.pid, link, dir: isAbsolute(dir) ? dir : resolve(os.cwd(), dir), checkout }))
}
