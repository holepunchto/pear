'use strict'
const { print, InputError } = require('./iface')
const parse = require('../lib/parse')

module.exports = (ipc) => async function link (args) {
  const { _, store } = parse.args(args, { string: ['store'] })
  try {
    const [key] = _

    if (!key || key.startsWith('pear://') === false) throw InputError('Pear Key link (pear://...) is required')
    const wokeup = await ipc.link({ key, storage: store })
    if (wokeup === false) {
      const run = require('./run')(ipc)
      return run(args)
    }
    await ipc.close()
  } catch (err) {
    if (err instanceof InputError || err.code === 'ERR_INVALID_FLAG') {
      print(err.message, false)
      await ipc.usage.output('release', false)
    } else {
      print('An error occured', false)
      console.error(err)
    }
    Bare.exit(1)
  }
}
