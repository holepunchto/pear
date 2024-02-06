'use strict'
const PLATFORM = (global.Bare || global.process).platform
const ARCH = (global.Bare || global.process).arch

const BIN = 'by-arch/' + PLATFORM + '-' + ARCH + '/bin/'

const IS_WINDOWS = PLATFORM === 'win32'
const IS_LINUX = PLATFORM === 'linux'
const IS_MAC = PLATFORM === 'darwin'

const url = module.url || electronModuleURL()
const mount = new URL('..', url)

const CHECKOUT = require('../checkout')
const LOCALDEV = CHECKOUT.length === null
const SEP = IS_WINDOWS ? '\\' : '/'

const swapURL = mount.pathname.endsWith('.bundle/') ? new URL('..', mount) : mount
const swapPath = toPath(swapURL) // strip /

const IPC_ID = 'pear'
const PLATFORM_URL = LOCALDEV ? new URL('pear/', swapURL) : new URL('../../../', swapURL)
const PLATFORM_DIR = toPath(PLATFORM_URL)

const DESKTOP_EXEC = IS_WINDOWS
  ? 'pear-runtime-app/Pear Runtime.exe'
  : IS_LINUX
    ? 'pear-runtime-app/pear-runtime'
    : 'Pear Runtime.app/Contents/MacOS/Pear Runtime'

const ALIASES = {
  keet: {
    z32: 'oeeoz3w6fjjt7bym3ndpa6hhicm8f8naxyk11z4iypeoupn6jzpo',
    hex: '82110be69e2a531e840bc886dc7b9cab16729c587815295f55035109b45e4ddb'
  },
  runtime: {
    z32: 'mer3xdsu76esgho6tqabspjn7h5cmf3ajqnrqqkbmrmhpsghtt6o',
    hex: '5ba2116ef4ff240e9eeef9c8af956884f78c4105053e061b5bc506229a6409fb'
  }
}

const EOLS = {
  keet: {
    z32: 'jc38t9nr7fasay4nqfxwfaawywfd3y14krnsitj67ymoubiezqdy',
    hex: '4b3278fc44e9716c0342715f42e314050a3c825a51056ac53ee8170986a8bb86'
  }
}
exports.ALIASES = ALIASES
exports.EOLS = EOLS
exports.SWAP = swapPath
exports.PLATFORM_DIR = PLATFORM_DIR
exports.PLATFORM_CORESTORE = toPath(new URL('corestores/platform', PLATFORM_URL))
exports.MOUNT = mount.href.slice(0, -1)
exports.PREBUILDS = swapPath + SEP + 'prebuilds'
exports.CHECKOUT = CHECKOUT
exports.LOCALDEV = LOCALDEV
exports.SOCKET_PATH = IS_WINDOWS ? `\\\\.\\pipe\\${IPC_ID}` : `${PLATFORM_DIR}/${IPC_ID}.sock`
exports.IS_MAC = IS_MAC
exports.IS_WINDOWS = IS_WINDOWS
exports.IS_LINUX = IS_LINUX
exports.IS_BARE = !!global.Bare
exports.CONNECT_TIMEOUT = 20_000
exports.IDLE_TIMEOUT = 30_000
exports.RUNTIME = toPath(new URL(BIN + 'pear-runtime', swapURL))
exports.DESKTOP_RUNTIME = toPath(new URL(BIN + DESKTOP_EXEC, swapURL))
exports.APPLINGS_PATH = IS_WINDOWS ? `${PLATFORM_DIR}\\applings` : `${PLATFORM_DIR}/applings`
exports.SPINDOWN_TIMEOUT = 60000

function toPath (url) {
  const pathname = decodeURIComponent(url.pathname).replace(/[/\\]$/, '')
  if (IS_WINDOWS) {
    if (url.hostname) return '\\\\' + url.hostname + pathname
    return pathname.slice(1)
  }
  return pathname
}

function electronModuleURL () {
  const u = require('url').pathToFileURL(process.execPath)
  const i = u.href.lastIndexOf(BIN)
  if (i === -1) throw new Error('Could not infer the actual module path')
  return new URL(u.href.slice(0, i) + 'lib/constants.js')
}
