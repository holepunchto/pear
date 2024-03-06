'use strict'
const HypercoreID = require('hypercore-id-encoding')
const { platform, arch, isWindows, isLinux } = require('which-runtime')

const BIN = 'by-arch/' + platform + '-' + arch + '/bin/'

const url = module.url || electronModuleURL()
const mount = new URL('..', url)

const CHECKOUT = require('../checkout')
const LOCALDEV = CHECKOUT.length === null

const swapURL = mount.pathname.endsWith('.bundle/') ? new URL('..', mount) : mount
const swapPath = toPath(swapURL) // strip /

const IPC_ID = 'pear'
const PLATFORM_URL = LOCALDEV ? new URL('pear/', swapURL) : new URL('../../../', swapURL)
const PLATFORM_DIR = toPath(PLATFORM_URL)

const DESKTOP_EXEC = isWindows
  ? 'pear-runtime-app/Pear Runtime.exe'
  : isLinux
    ? 'pear-runtime-app/pear-runtime'
    : 'Pear Runtime.app/Contents/MacOS/Pear Runtime'

const ALIASES = {
  keet: getKeys('oeeoz3w6fjjt7bym3ndpa6hhicm8f8naxyk11z4iypeoupn6jzpo'),
  runtime: getKeys('nkw138nybdx6mtf98z497czxogzwje5yzu585c66ofba854gw3ro')
}

const EOLS = {
  keet: getKeys('jc38t9nr7fasay4nqfxwfaawywfd3y14krnsitj67ymoubiezqdy')
}

exports.LOCALDEV = LOCALDEV
exports.CHECKOUT = CHECKOUT
exports.ALIASES = ALIASES
exports.EOLS = EOLS

exports.SWAP = swapPath
exports.PLATFORM_DIR = PLATFORM_DIR
exports.PLATFORM_CORESTORE = toPath(new URL('corestores/platform', PLATFORM_URL))
exports.UPGRADE_LOCK = toPath(new URL('lock', PLATFORM_URL))
exports.APPLINGS_PATH = toPath(new URL('applings', PLATFORM_URL))
exports.MOUNT = mount.href.slice(0, -1)
exports.SOCKET_PATH = isWindows ? `\\\\.\\pipe\\${IPC_ID}` : `${PLATFORM_DIR}/${IPC_ID}.sock`
exports.BOOT = require.main.filename

exports.CONNECT_TIMEOUT = 20_000
exports.IDLE_TIMEOUT = 30_000
exports.SPINDOWN_TIMEOUT = 60_000

exports.RUNTIME = toPath(new URL(BIN + 'pear-runtime', swapURL))
exports.DESKTOP_RUNTIME = toPath(new URL(BIN + DESKTOP_EXEC, swapURL))

function toPath (url) {
  const pathname = decodeURIComponent(url.pathname).replace(/[/\\]$/, '')
  if (isWindows) {
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

function getKeys (z32) {
  return {
    z32,
    hex: HypercoreID.decode(z32).toString('hex')
  }
}
