'use strict'
const fsp = require('bare-fs/promises')
const os = require('bare-os')
const { basename, resolve } = require('bare-path')
const { ansi, trust, outputter } = require('./iface')

const output = outputter('init', {
  writing: () => '',
  error: ({ code, stack }) => `Init Error (code: ${code || 'none'}) ${stack}`,
  wrote: ({ path }) => `* ${path}`,
  written: () => ''
})

module.exports = (ipc) => async function init (cmd) {
  const cwd = os.cwd()

  const { yes, force, type, with: w } = cmd.flags
  const dir = cmd.args.dir ? resolve(cwd, cmd.args.dir) : cwd
  let dirStat = null
  try { dirStat = await fsp.stat(dir) } catch {}
  const pkgPath = resolve(dir, 'package.json')
  let pkg = null
  const dirExists = dirStat !== null && dirStat.isDirectory()
  if (dirExists) {
    try { pkg = JSON.parse(await fsp.readFile(pkgPath)) } catch {}
  }

  const cfg = pkg?.pear || pkg?.holepunch || {}
  const height = cfg.gui ? cfg.gui.height : 540
  const width = cfg.gui ? cfg.gui.width : 720
  const name = cfg?.name || pkg?.name || basename(dir)
  const link = wither(type, w) || cmd.args.link || 'desktop'

  const defaults = { height, width, name }

  const banner = `${ansi.bold(name)} ~ ${ansi.dim('Welcome to the Internet of Peers')}`
  let header = `\n${banner}${ansi.dim('›')}\n\n`
  if (force) header += ansi.bold('FORCE MODE\n\n')
  try {
    await output(false, await require('../init')(link, dir, { ipc, autosubmit: yes, force, defaults, header }))
  } catch (err) {
    if (err.code !== 'ERR_PERMISSION_REQUIRED') throw err
    const explain = 'Be sure that software is trusted before using it\n' +
    '\nType "TRUST" to allow template initialization or anything else to exit\n\n'
    const ask = 'Trust template'
    const act = 'Use pear init again to initalize from trusted template'
    await trust({ ipc, key: err.info.key, message: err.message, explain, ask, act })
  } finally {
    await ipc.close()
  }
}

function wither (type, w) {
  if (type === 'terminal' && w === 'node') return 'terminal-node'
  return type
}
