'use strict'
const { outputter, ansi } = require('pear-terminal')
const output = outputter('presets', {
  presets: ({ presets }, { link }) => {
    let out = ''
    if (presets) {
      out += `Presets for ${ansi.bold(link)} ${ansi.bold(presets.command)}: ${ansi.green(presets.flags)}\n`
    } else {
      out += `Presets reset for ${ansi.bold(link)}\n`
    }
    return out
  },
  error: ({ message }) => {
    return `Error: ${message}\n`
  }
})

module.exports = (ipc) =>
  async function presets(cmd) {
    const command = cmd.args.command
    const link = cmd.args.link
    const flags = cmd.rest?.join(' ')
    const json = cmd.flags.json
    await output(json, ipc.presets({ link, command, flags, reset: !flags }), {
      link
    })
  }
