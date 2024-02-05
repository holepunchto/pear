if (global.Bare) { // tmp hack to enable bare:addon support
  const resolve = global.Bare.Addon.resolve
  global.Bare.Addon.resolve = function (specifier, parent, opts) {
    const res = global.Bare.Addon.currentResolutions || opts.referrer.resolutions
    const dir = new URL(specifier, parent)
    const r = res && (res[dir.href.replace(/\/$/, '')] || res[decodeURI(dir.pathname).replace(/\/$/, '')])

    if (r && r['bare:addon']) {
      return new URL(r['bare:addon'])
    }

    return resolve.call(global.Bare.Addon, specifier, parent, opts)
  }
}

const BOOT_SIDECAR = 1
const BOOT_TERMINAL = 2
const BOOT_CLI = 3
const BOOT_ELECTRON = 4
const BOOT_ELECTRON_PRELOAD = 5

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
    require('./electron.js')
    break
  }
  case BOOT_ELECTRON_PRELOAD: {
    require('./preload.js')
    break
  }
}

function getBootType () {
  if (global.process && global.process.versions.electron) {
    return (global.process.type === 'renderer' || global.process.type === 'worker') ? BOOT_ELECTRON_PRELOAD : BOOT_ELECTRON
  }
  if (global.Bare.argv.includes('--sidecar')) {
    return BOOT_SIDECAR
  }
  return BOOT_CLI
}
