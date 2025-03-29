'use strict'
const { outputter } = require('./iface')

const output = outputter('presets', {
  updated: (result, info) => {
    console.log(`\nDefault configuration for ${info.link} updated:\n`)
    console.log(result)
    console.log('\n')
  }
})

module.exports = (ipc) => async function presets (cmd) {
  const { command } = cmd
  const { json } = command.parent.flags
  const { link } = command.args
  const flags = command.flags
  const result = await ipc.presets({ link, flags })
  await output(json, result, { link }, this.ipc)
}
