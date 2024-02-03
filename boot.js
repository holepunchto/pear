{ // tmp hack to enable bare:addon support
  const resolve = Bare.Addon.resolve
  Bare.Addon.resolve = function (specifier, parent, opts) {
    const res = Bare.Addon.currentResolutions || opts.referrer.resolutions
    const dir = new URL(specifier, parent)
    const r = res && res[dir.href.replace(/\/$/, '')]

    if (r && r['bare:addon']) {
      return new URL(r['bare:addon'])
    }

    return resolve.call(Bare.Addon, specifier, parent, opts)
  }
}

await import('./boot-tmp.js')
