'use strict'
const { outputter } = require('./iface')

const output = outputter('presets', {
  updated: (result, info) => {
    console.log(`\nDefault configuration for ${info.link} updated:\n`)
    console.log(`${JSON.stringify(result, 0, 2)}\n`)
  },
  info: (result, info) => {
    if (result) {
      console.log(`\nDefault configuration for ${info.link} is:\n`)
      console.log(`${JSON.stringify(result, 0, 2)}\n`)
    } else {
      console.log(`\nDefault configuration for ${info.link} is not defined.\n`)
    }
  },
  error: ({ message }) => {
    console.log(`\n${message}.\n`)
  }
})

module.exports = (ipc) => async function presets (cmd) {
  const { command } = cmd
  const { json } = command.parent.flags
  const { link } = command.args
  const flags = command.flags
  const isPrint = Object.keys(command.indices.flags).length === 0
  const result = await ipc.presets({ link, flags: isPrint ? null : flags })
  await output(json, result, { link }, this.ipc)
}
