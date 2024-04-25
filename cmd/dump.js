'use strict'
const os = require('bare-os')
const { isAbsolute, resolve } = require('bare-path')
const { outputter, print, InputError } = require('./iface')
const output = outputter('stage', {
  dumping: ({ key, dir }) => `\n🍐 Dumping ${key} into ${dir}`,
  complete: '\nDumping complete!\n',
  error: ({ code, stack }) => `Dumping Error (code: ${code || 'none'}) ${stack}`
})

module.exports = (ipc) => async function dump (cmd) {
  try {
    const { checkout, json } = cmd.flags
    const [key, dir = os.cwd()] = cmd.args
    if (!dir) throw new InputError('Output dir must be specified.')
    if (!key) throw new InputError('The pear key must be specified.')
    await output(json, ipc.dump({ id: Bare.pid, key, dir: isAbsolute(dir) ? dir : resolve(os.cwd(), dir), checkout }))
  } catch (err) {
    if (err instanceof InputError || err.code === 'ERR_INVALID_FLAG') {
      print(err.message, false)
      ipc.userData.usage.output('dump')
    } else {
      console.error(err)
    }
  } finally {
    await ipc.close()
  }
}
