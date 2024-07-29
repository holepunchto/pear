'use strict'
const DriveBundler = require('drive-bundler')
const Module = require('bare-module')
const { MOUNT, SWAP } = require('./constants.js')

module.exports = async function subsystem (drive, entrypoint) {
  const cache = require.cache
  const res = await DriveBundler.bundle(drive, {
    entrypoint,
    cache,
    cwd: SWAP,
    mount: MOUNT,
    absolutePrebuilds: true
  })

  const protocol = new Module.Protocol({
    exists (url) {
      return Object.hasOwn(res.sources, url.href) || Object.hasOwn(cache, url.href)
    },
    read (url) {
      return res.sources[url.href]
    }
  })

  const mod = Module.load(new URL(MOUNT + entrypoint), {
    protocol,
    resolutions: res.resolutions,
    cache
  })

  return mod.exports
}
