const url = module.url || require('url').pathToFileURL(__filename)
const mount = new URL('..', url)

const PLATFORM = (global.Bare || global.process).platform
const ARCH = (global.Bare || global.process).arch
const CHECKOUT = null
const IS_WINDOWS = PLATFORM === 'win32'
const IS_LINUX = PLATFORM === 'linux'
const SEP = IS_WINDOWS ? '\\' : '/'

const swapURL = mount.pathname.endsWith('.bundle/') ? new URL('..', mount) : mount
const swapPath = toPath(swapURL) // strip /

const IPC_ID = 'pear'
const PLATFORM_DIR = toPath(CHECKOUT ? new URL('../../..', swapURL) : new URL('pear', swapURL))

const BIN = 'by-arch/' + PLATFORM + '-' + ARCH + '/bin/'
const DESKTOP_EXEC = IS_WINDOWS
  ? 'pear-runtime-app/Pear Runtime.exe'
  : IS_LINUX
    ? 'pear-runtime-app/pear-runtime'
    : 'Pear Runtime.app/Contents/MacOS/Pear Runtime'

exports.SWAP = swapPath
exports.PLATFORM_DIR = PLATFORM_DIR
exports.MOUNT = mount.href.slice(0, -1)
exports.PREBUILDS = swapPath + SEP + 'prebuilds'
exports.CHECKOUT = CHECKOUT
exports.LOCALDEV = !CHECKOUT
exports.SOCKET_PATH = IS_WINDOWS ? `\\\\.\\pipe\\${IPC_ID}` : `${PLATFORM_DIR}/${IPC_ID}.sock`
exports.IS_MAC = PLATFORM === 'darwin'
exports.IS_WINDOWS = IS_WINDOWS
exports.IS_LINUX = IS_LINUX
exports.CONNECT_TIMEOUT = 20_000
exports.IDLE_TIMEOUT = 30_000
exports.RUNTIME = toPath(new URL(BIN + 'pear-runtime', swapURL))
exports.DESKTOP_RUNTIME = toPath(new URL(BIN + DESKTOP_EXEC, swapURL))

function toPath (url) {
  const pathname = decodeURIComponent(url.pathname).replace(/[\/\\]$/, '')
  if (IS_WINDOWS) {
    if (url.hostname) return '\\\\' + url.hostname + pathname
    return pathname.slice(1)
  }
  return pathname
}
