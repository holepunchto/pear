'use strict'
const fsp = require('bare-fs/promises')
const os = require('bare-os')
const { basename, resolve } = require('bare-path')
const { ansi, outputter, permit } = require('pear-terminal')
const API = require('pear-api')
const State = require('pear-state')

const output = outputter('init', {
  writing: () => '',
  wrote: ({ path }) => `* ${path}`,
  written: () => ''
})

module.exports = (ipc) =>
  async function init(cmd) {
    const cwd = os.cwd()

    const { yes, force, ask } = cmd.flags
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
    const link = cmd.args.link || 'default'

    const defaults = { name }

    const banner = `${ansi.bold(name)} ~ ${ansi.dim('Welcome to the Internet of Peers')}`
    let header = `\n${banner}${ansi.dim('›')}\n\n`
    if (force) header += ansi.bold('FORCE MODE\n\n')

    const cmdArgs = cmd.command.argv
    const state = new State({ flags: cmd.flags, link, dir, cmdArgs, cwd })
    await ipc.ready()
    const config = await ipc.config()
    state.update({ config })
    global.Pear = new API(ipc, state)
    const init = require('pear-init')
    const stream = init(link, {
      dir,
      cwd,
      autosubmit: yes,
      ask,
      force,
      defaults,
      header,
      pkg
    })
    try {
      await output(false, stream)
    } catch (err) {
      if (err.code !== 'ERR_PERMISSION_REQUIRED' || !ask) throw err
      await permit(ipc, err.info, 'init')
    } finally {
      await ipc.close()
    }
  }
