'use strict'
const os = require('bare-os')
const { basename, resolve } = require('bare-path')
const { ansi } = require('./iface')

module.exports = (ipc) => async function init (cmd) {
  const cwd = os.cwd()

  const { yes, force, type = 'desktop', with: w } = cmd.flags
  const dir = cmd.args.dir ? resolve(cwd, cmd.args.dir) : cwd

  const cfg = pkg?.pear || pkg?.holepunch || {}
  const height = cfg.gui ? cfg.gui.height : 540
  const width = cfg.gui ? cfg.gui.width : 720
  const name = cfg?.name || pkg?.name || basename(dir)

  const defaults = { height, width, name }

  const banner = `${ansi.bold(name)} ~ ${ansi.dim('Welcome to the Internet of Peers')}`
  let header = `\n${banner}${ansi.dim('›')}\n\n`
  if (pkg) header += ansi.bold('Existing package.json detected, will merge\n\n')
  if (force) header += ansi.bold('FORCE MODE\n\n')

  await require('../init')(link, dir, { ipc, autosubmit: yes, force, defaults })
}
