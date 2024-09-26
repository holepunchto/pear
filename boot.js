/** @typedef {import('pear-interface')} */
'use strict'
const { isElectron, isElectronRenderer, isElectronWorker, platform, arch, isWindows } = require('which-runtime')

const BOOT_AS = 0
const BOOT_SIDECAR = 1
const BOOT_CLI = 2
const BOOT_ELECTRON = 3
const BOOT_ELECTRON_PRELOAD = 4
let cmd = null

switch (getBootType()) {
  case BOOT_AS: {
    const path = require('bare-path')
    const argv = Bare.argv.slice(1)
    const gap = argv[cmd.indices.flags.as] === cmd.flags.as ? 1 : 0
    argv.splice(cmd.indices.flags.as - gap, 1 + gap)
    const runtime = path.join(cmd.flags.as, 'by-arch', platform + '-' + arch, 'bin', 'pear-runtime' + (isWindows ? '.exe' : ''))
    require('bare-subprocess').spawn(runtime, argv, { stdio: 'inherit' })
    break
  }
  case BOOT_SIDECAR: {
    require('./sidecar.js')
    break
  }
  case BOOT_CLI: {
    require('./cli.js')
    break
  }
  case BOOT_ELECTRON: {
    require('./electron-main.js')
    break
  }
  case BOOT_ELECTRON_PRELOAD: {
    require('./preload.js')
    break
  }
}

function getBootType () {
  if (isElectron) {
    return (isElectronRenderer || isElectronWorker)
      ? BOOT_ELECTRON_PRELOAD
      : BOOT_ELECTRON
  }
  const { command, arg, hiddenFlag } = require('paparam')
  cmd = command('pear', hiddenFlag('--sidecar'), hiddenFlag('--as <swap>'), arg('[cmd]'))
  cmd.parse(global.Bare.argv.slice(1))
  if (cmd.flags.as) return BOOT_AS
  if (cmd.flags.sidecar) return BOOT_SIDECAR
  return BOOT_CLI
}
