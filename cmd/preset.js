'use strict'
const { outputter, ansi } = require('pear-terminal')
const output = outputter('preset', {
  preset: ({ preset }, { link }) => {
    let out = ''
    if (preset) {
      out += `Preset for ${ansi.bold(link)} ${ansi.bold(preset.command)}: ${ansi.green(preset.flags)}\n`
    } else {
      out += `Preset reset for ${ansi.bold(link)}\n`
    }
    return out
  },
  error: ({ message }) => {
    return `Error: ${message}\n`
  }
})

module.exports = (ipc) =>
  async function preset(cmd) {
    const command = cmd.args.command
    const link = cmd.args.link
    const flags = cmd.rest?.join(' ')
    const json = cmd.flags.json
    await output(json, ipc.preset({ link, command, flags, reset: !flags }), {
      link
    })
  }
