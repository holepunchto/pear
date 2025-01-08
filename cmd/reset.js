'use strict'
const { outputter, confirmReset } = require('./iface')
const os = require('bare-os')
const path = require('bare-path')

const output = outputter('reset', {
  reseting: ({ link }) => `Reseting storage of application ${link}}`,
  complete: () => '\nReset Complete',
  error: ({ code, stack, message }) => {
    console.log(code, message, stack)
  }
})

module.exports = (ipc) => async function reset (cmd) {
  const { json } = cmd.flags
  const link = cmd.args.link
  const isPear = link.startsWith('pear://')
  await confirmReset(link)
  await output(json, ipc.reset({ link: isPear ? link : path.join(os.cwd(), link) }))
}
