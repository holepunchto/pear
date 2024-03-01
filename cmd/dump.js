'use strict'
const os = require('bare-os')
const { isAbsolute, resolve } = require('bare-path')
const { outputter, print, InputError } = require('./iface')
const parse = require('../lib/parse')
const output = outputter('stage', {
  dumping: ({ key, dir }) => `\n🍐 Dumping ${key} into ${dir}`,
  complete: '\nDumping complete!\n',
  error: ({ code, stack }) => `Dumping Error (code: ${code || 'none'}) ${stack}`
})

module.exports = (rpc) => async function dump (args) {
  try {
    const { _, checkout, json } = parse.args(args, { boolean: ['json'] })
    const [key, dir] = _
    if (!dir) throw new InputError('Output dir must be specified.')
    if (!key) throw new InputError('The pear key must be specified.')
    await output(json, rpc.dump({ id: Bare.pid, key, dir: isAbsolute(dir) ? dir : resolve(os.cwd(), dir), checkout }))
  } catch (err) {
    if (err instanceof InputError || err.code === 'ERR_INVALID_FLAG') {
      print(err.message, false)
      await rpc.usage.output('dump')
    } else {
      console.error(err)
    }
  }
}
