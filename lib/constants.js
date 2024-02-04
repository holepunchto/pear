const url = module.url || require('url').pathToFileURL(__filename)
const mount = new URL('..', url)

const PLATFORM = (global.Bare || global.process).platform
const CHECKOUT = null
const IS_WINDOWS = PLATFORM === 'win32'
const SEP = IS_WINDOWS ? '\\' : '/'

const swapURL = mount.pathname.endsWith('.bundle/') ? new URL('..', mount) : mount
const swapPath = toPath(swapURL) // strip /

const IPC_ID = 'pear'
const PLATFORM_DIR = toPath(CHECKOUT ? new URL('../../..', swapURL) : new URL('pear', swapURL))

exports.SWAP = swapPath
exports.PLATFORM_DIR = PLATFORM_DIR
exports.MOUNT = mount.href.slice(0, -1)
exports.PREBUILDS = swapPath + SEP + 'prebuilds'
exports.CHECKOUT = CHECKOUT
exports.LOCALDEV = !CHECKOUT
exports.SOCKET_PATH = IS_WINDOWS ? `\\\\.\\pipe\\${IPC_ID}` : `${PLATFORM_DIR}/${IPC_ID}.sock`
exports.IS_MAC = PLATFORM === 'darwin'
exports.IS_WINDOWS = IS_WINDOWS
exports.IS_LINUX = PLATFORM === 'linux'

function toPath (url) {
  const pathname = decodeURIComponent(url.pathname).replace(/[\/\\]$/, '')
  if (IS_WINDOWS) {
    if (url.hostname) return '\\\\' + url.hostname + pathname
    return pathname.slice(1)
  }
  return pathname
}
