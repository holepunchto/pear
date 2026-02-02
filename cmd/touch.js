'use strict'
const { outputter, ansi } = require('pear-terminal')
const os = require('bare-os')

const output = outputter('touch', {
  final: ({ verlink, link, channel }) => {
    return {
      output: 'print',
      success: Infinity, // omit success ansi tick
      message: `\n${ansi.dim(`[ channel: ${channel} ]`)}\n\n${ansi.gray(ansi.dim(verlink))}\n\n[  ${link}  ]`
    }
  },
  error: ({ message }) => {
    return `Error: ${message}\n`
  }
})

module.exports = async function touch(cmd) {
  const ipc = global.Pear[global.Pear.constructor.IPC]
  const json = cmd.flags.json
  const channel = cmd.args.channel
  await output(json, ipc.touch({ channel }))
}
