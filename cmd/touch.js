'use strict'
const { outputter, ansi } = require('pear-terminal')

const output = outputter('touch', {
  final: ({ verlink, link }) => {
    return {
      output: 'print',
      success: Infinity, // omit success ansi tick
      message: `\n${ansi.gray(ansi.dim(verlink))}\n\n[  ${link}  ]`
    }
  },
  error: ({ message }) => {
    return `Error: ${message}\n`
  }
})

module.exports = async function touch(cmd) {
  const ipc = global.Pear[global.Pear.constructor.IPC]
  const dir = cmd.args.dir
  const json = cmd.flags.json
  await output(json, ipc.touch({ dir }))
}
