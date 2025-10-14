'use strict'
const { outputter, ansi } = require('pear-terminal')
const output = outputter('preset', {
  result: ({ preset }, { link }) => {
    let out = `Preset for ${ansi.bold(link)} ${ansi.bold(preset.command)}: ${ansi.green(preset.configuration)}\n`
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
    const configuration = cmd.rest?.join(' ')
    const json = cmd.flags.json
    await output(
      json,
      ipc.preset({ link, command, configuration, reset: !!configuration }),
      { link }
    )
  }
