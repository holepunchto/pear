'use strict'
const { ERR_INVALID_INPUT } = require('../errors')
const { isAbsolute, resolve } = require('bare-path')
const { outputter, password } = require('./iface')

const output = outputter('stage', {
  dumping: ({ link, dir, list }) => list > -1 ? '' : `\n🍐 Dumping ${link} into ${dir}`,
  file: ({ key, value }) => `${key}${value ? '\n' + value : ''}`,
  complete: '\nDumping complete!\n',
  error: (err, info, ipc) => {
    if (err.info && err.info.encrypted && info.ask) {
      const explain = 'This application is encrypted.\n' +
        '\nEnter the password to dump the app.\n\n'
      const message = 'Added encryption key, run dump again to complete it.'
      return password({ ipc, key: err.info.key, explain, message })
    }
    return `Dumping Error (code: ${err.code || 'none'}) ${err.stack}`
  }
})

module.exports = (ipc) => async function dump (cmd) {
  const { checkout, json, encryptionKey, ask } = cmd.flags
  const { link } = cmd.args
  let { dir } = cmd.args
  if (!link) throw ERR_INVALID_INPUT('<link> must be specified.')
  if (!dir) throw ERR_INVALID_INPUT('<dir> must be specified.')
  dir = dir === '-' ? '-' : (isAbsolute(dir) ? dir : resolve('.', dir))
  await output(json, ipc.dump({ id: Bare.pid, link, dir, checkout, encryptionKey }), { ask }, ipc)
}
