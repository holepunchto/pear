'use strict'
const { outputter, ansi } = require('pear-terminal')
const output = outputter('presets', {
  final: ({ presets }, { link }) => {
    let out = ''
    if (presets) {
      out += `${presets.flags}\n`
    } else {
      out += `[ none set ]\n`
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
