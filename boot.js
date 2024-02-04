if (global.Bare) { // tmp hack to enable bare:addon support
  const resolve = global.Bare.Addon.resolve
  global.Bare.Addon.resolve = function (specifier, parent, opts) {
    const res = global.Bare.Addon.currentResolutions || opts.referrer.resolutions
    const dir = new URL(specifier, parent)
    const r = res && res[dir.href.replace(/\/$/, '')]

    if (r && r['bare:addon']) {
      return new URL(r['bare:addon'])
    }

    return resolve.call(global.Bare.Addon, specifier, parent, opts)
  }
}

// quick sniff is this is actually the cli for mega fast cli bool
if (global.process) {
  require('./electron.js')
} else if (global.Bare.argv.indexOf('--sidecar') > -1) {
  require('./sidecar.js')
} else {
  require('./cli.js')
}
