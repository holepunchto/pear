const Module = require('bare-module')

module.exports = async function (channel, key) {
  const res = await channel.request('run', [key])

  const protocol = new Module.Protocol({
    exists (url) {
      return Object.hasOwn(res.sources, url.href)
    },
    read (url) {
      return res.sources[url.href]
    }
  })

  channel.protomux.stream.rawStream.unref()

  // pear://key/<entrypoint>
  const mod = Module.load(new URL('pear://' + res.key + encodeURI(res.entrypoint)), {
    protocol,
    resolutions: res.resolutions
  })

  return mod.exports
}
