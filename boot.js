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
  if (global.process && global.process.versions.electron) {
    return (global.process.type === 'renderer' || global.process.type === 'worker')
      ? BOOT_ELECTRON_PRELOAD
      : BOOT_ELECTRON
  }
  if (global.Bare.argv.includes('--sidecar')) {
    return BOOT_SIDECAR
  }
  return BOOT_CLI
}
