'use strict'
const { outputter, print } = require('./iface')
const parse = require('../lib/parse')
const { INPUT_ERROR } = require('../lib/errors')

const output = outputter('shift', {
  moving: ({ src, dst, force }) => `Moving user application storage\n\nFrom: ${src}\nTo: ${dst}\n${force ? '\nForce flag used, overwriting existing application storage.' : ''}`,
  complete: ({ from, to }) => `Moved\n\nFrom: ${from}\nTo: ${to}\n\nShift Complete`,
  error: ({ code, stack, message }) => {
    if (code === 'ERR_EXISTS' || code === 'ERR_NOENT') throw Object.assign(new Error(message), { code })
    return `Shift Error (code: ${code || 'none'}) ${stack}`
  }
})

module.exports = (ipc) => async function shift (args) {
  try {
    const { _, force, json } = parse.args(args, {
      boolean: ['force', 'json']
    })
    const [src, dst] = _

    if (!src || parse.runkey(src.toString()).key === null) {
      throw INPUT_ERROR('A source application key must be specified.')
    }

    if (!dst || parse.runkey(dst.toString()).key === null) {
      throw INPUT_ERROR('A destination application key must be specified.')
    }

    await output(json, ipc.shift({ src, dst, force }))
  } catch (err) {
    if (err.code === 'ERR_INPUT' || err.code === 'ERR_INVALID_FLAG' || err.code === 'ERR_EXISTS' || err.code === 'ERR_NOENT') {
      print(err.message, false)
      ipc.userData.usage.output('shift')
    } else {
      print('An error occured', false)
      console.error(err)
    }
    Bare.exit(1)
  } finally {
    await ipc.close()
  }
}
