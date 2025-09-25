'use strict'
const os = require('bare-os')
const build = require('pear-build')

module.exports = () => async function build (cmd) {
  const link = cmd.args.link
  const { dir = os.cwd() } = cmd.args
  await build({ link, dir })
}
