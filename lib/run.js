const Module = require('bare-module')

module.exports = async function (channel, key) {
  const res = await channel.request('run', [key])

  const protocol = new Module.Protocol({
    exists (url) {
      return Object.hasOwn(res.sources, decodeURI(url.pathname))
    },
    read (url) {
      return res.sources[decodeURI(url.pathname)]
    }
  })

  global.Bare.Addon.currentResolutions = res.resolutions

  const mod = Module.load(new URL(res.entrypoint, 'file://'), {
    protocol,
    resolutions: res.resolutions,
    cache: Object.create(null)
  })

  global.Bare.Addon.currentResolutions = null

  return mod.exports
}
