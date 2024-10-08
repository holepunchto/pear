/** @typedef {import('pear-interface')} */
'use strict'
const { isElectron, isElectronRenderer, isElectronWorker } = require('which-runtime')
const BOOT_SIDECAR = 1
const BOOT_CLI = 2
const BOOT_ELECTRON = 3
const BOOT_ELECTRON_PRELOAD = 4
switch (getBootType()) {
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
  if (global.Bare.argv[1] === '--sidecar') return BOOT_SIDECAR
  return BOOT_CLI
}
