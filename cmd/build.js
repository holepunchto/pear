'use strict'
const output = outputter('build', {
  mirroring: ({ from, to, message }) => from + ' ' + message + ' ' + to,
  mirrored: ({ from, to, message }) => from + ' ' + message + ' ' + to
})

module.exports = async function build(cmd) {
  await output(
    cmd.flags.json,
    await require('pear-build')(cmd.flags)
  )
}
