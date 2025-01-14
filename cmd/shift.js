'use strict'
const { outputter } = require('./iface')
const parseLink = require('../lib/parse-link')
const { ERR_INVALID_INPUT } = require('../errors')

const output = outputter('shift', {
  moving: ({ src, dst, force }) => `Shifting user application storage\n\nFrom: ${src}\nTo: ${dst}\n${force ? '\nForce flag used, overwriting existing application storage.' : ''}`,
  complete: ({ oldDst, newDst, newSrc, src, dst }) => `Shifted\n\n${src}:\n    Old: ${newDst}\n    New: ${newSrc}\n\n${dst}:\n    Old: ${oldDst}\n    New: ${newDst}\n\nShift Complete`,
  error: ({ code, stack, message }) => {
    if (code === 'ERR_EXISTS' || code === 'ERR_NOENT') throw Object.assign(new Error(message), { code })
    return `Shift Error (code: ${code || 'none'}) ${stack}`
  }
})

module.exports = (ipc) => async function shift (cmd) {
  const { force, json } = cmd.flags
  const src = cmd.args.source
  const dst = cmd.args.destination

  if (parseLink(src).drive.key === null) {
    throw ERR_INVALID_INPUT('A valid source application link must be specified.')
  }

  if (parseLink(dst).drive.key === null) {
    throw ERR_INVALID_INPUT('A valid destination application link must be specified.')
  }

  await output(json, ipc.shift({ src, dst, force }))
}
