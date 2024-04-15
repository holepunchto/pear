'use strict'
const os = require('bare-os')
const { isAbsolute, resolve } = require('bare-path')
const { outputter, print } = require('./iface')
const parse = require('../lib/parse')
const { INPUT_ERROR } = require('../lib/errors')
const output = outputter('stage', {
  dumping: ({ key, dir }) => `\n🍐 Dumping ${key} into ${dir}`,
  complete: '\nDumping complete!\n',
  error: ({ code, stack }) => `Dumping Error (code: ${code || 'none'}) ${stack}`
})

module.exports = (ipc) => async function dump (args) {
  try {
    const { _, checkout, json } = parse.args(args, { boolean: ['json'] })
    const [key, dir] = _
    if (!dir) throw INPUT_ERROR('Output dir must be specified.')
    if (!key) throw INPUT_ERROR('The pear key must be specified.')
    await output(json, ipc.dump({ id: Bare.pid, key, dir: isAbsolute(dir) ? dir : resolve(os.cwd(), dir), checkout }))
  } catch (err) {
    if (err.code === 'ERR_INPUT' || err.code === 'ERR_INVALID_FLAG') {
      print(err.message, false)
      ipc.userData.usage.output('dump')
    } else {
      console.error(err)
    }
  } finally {
    await ipc.close()
  }
}
