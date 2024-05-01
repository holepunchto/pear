'use strict'
const { outputter } = require('./iface')
const parse = require('../lib/parse')
const { ERR_INVALID_INPUT } = require('../lib/errors')

const output = outputter('shift', {
  moving: ({ src, dst, force }) => `Moving user application storage\n\nFrom: ${src}\nTo: ${dst}\n${force ? '\nForce flag used, overwriting existing application storage.' : ''}`,
  complete: ({ from, to }) => `Moved\n\nFrom: ${from}\nTo: ${to}\n\nShift Complete`,
  error: ({ code, stack, message }) => {
    if (code === 'ERR_EXISTS' || code === 'ERR_NOENT') throw Object.assign(new Error(message), { code })
    return `Shift Error (code: ${code || 'none'}) ${stack}`
  }
})

module.exports = (ipc) => async function shift (cmd) {
  const { force, json } = cmd.flags
  const src = cmd.args.source
  const dst = cmd.args.destination

  if (!src || parse.runkey(src).key === null) {
    throw new ERR_INVALID_INPUT('A source application key must be specified.')
  }

  if (!dst || parse.runkey(dst).key === null) {
    throw new ERR_INVALID_INPUT('A destination application key must be specified.')
  }

  await output(json, ipc.shift({ src, dst, force }))
}
