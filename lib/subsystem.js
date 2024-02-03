import DriveBundler from 'drive-bundler'
import Module from 'bare-module'
import { MOUNT, ROOT } from './constants.js'
import pkg from '../package.json'

const src = JSON.stringify(pkg)

export default async function subsystem (drive, entrypoint) {
  const res = await DriveBundler.bundle(drive, {
    entrypoint,
    cache: import.meta.cache,
    cwd: ROOT,
    mount: MOUNT,
    absolutePrebuilds: true
  })

  const protocol = new Module.Protocol({
    exists (url) {
      return Object.hasOwn(res.sources, url.href) || Object.hasOwn(import.meta.cache, url.href)
    },
    read (url) {
      return res.sources[url.href]
    }
  })

  Bare.Addon.currentResolutions = res.resolutions
  const mod = Module.load(new URL(MOUNT + entrypoint), {
    protocol,
    resolutions: res.resolutions,
    cache: import.meta.cache
  })
  Bare.Addon.currentResolutions = null
  return mod.exports.default
}
