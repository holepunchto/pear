const url = module.url || require('url').pathToFileURL(__filename)
const mount = new URL('..', url)

const PLATFORM = (global.Bare || global.process).platform
const SEP = PLATFORM === 'win32' ? '\\' : '/'

const root = mount.pathname.endsWith('.bundle/') ? new URL('..', mount) : mount
const rootPath = root.pathname.slice(0, -1) // strip /

exports.ROOT = rootPath
exports.PLATFORM = PLATFORM
exports.SEP = SEP
exports.MOUNT = mount.href.slice(0, -1)
exports.PRELOAD = rootPath + SEP + 'preload.cjs'
exports.PREBUILDS = rootPath + SEP + 'prebuilds'
