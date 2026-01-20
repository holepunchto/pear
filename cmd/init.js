'use strict'
const fsp = require('bare-fs/promises')
const os = require('bare-os')
const { basename, resolve } = require('bare-path')
const { ansi, outputter, permit } = require('pear-terminal')

const output = outputter('init', {
  writing: () => '',
  error: ({ code, stack }) => `Init Error (code: ${code || 'none'}) ${stack}`,
  wrote: ({ path }) => `* ${path}`,
  written: () => ''
})

module.exports = async function init(cmd) {
  const ipc = global.Pear[global.Pear.constructor.IPC]
  const cwd = os.cwd()
  const { yes, force, tmpl, ask } = cmd.flags
  const dir = cmd.args.dir ? resolve(cwd, cmd.args.dir) : cwd
  let dirStat = null
  try {
    dirStat = await fsp.stat(dir)
  } catch {}
  const pkgPath = resolve(dir, 'package.json')
  let pkg = null
  const dirExists = dirStat !== null && dirStat.isDirectory()
  if (dirExists) {
    try {
      pkg = JSON.parse(await fsp.readFile(pkgPath))
    } catch {}
  }

  const cfg = pkg?.pear || {}
  const name = cfg?.name || pkg?.name || basename(dir)
  const link = cmd.args.link || tmpl

  const defaults = { name }

  const banner = `${ansi.bold(name)} ~ ${ansi.dim('Welcome to the Internet of Peers')}`
  let header = `\n${banner}${ansi.dim('›')}\n\n`
  if (force) header += ansi.bold('FORCE MODE\n\n')

  try {
    await output(
      false,
      await require('../init')(link, dir, {
        cwd,
        ipc,
        autosubmit: yes,
        ask,
        force,
        defaults,
        header,
        tmpl,
        pkg
      })
    )
  } catch (err) {
    if (err.code !== 'ERR_PERMISSION_REQUIRED' || !ask) throw err
    await permit(ipc, err.info, 'init')
  } finally {
    await ipc.close()
  }
}
