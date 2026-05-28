'use strict'
const sodium = require('sodium-native')
const { platform, arch, isWindows, isLinux } = require('which-runtime')
const { fileURLToPath, pathToFileURL } = require('url-file-url')
const path = require('bare-path')
const os = require('bare-os')
const b4a = require('b4a')
const pkg = require('./package.json')

const BIN = 'by-arch/' + platform + '-' + arch + '/bin/'
const LOCALDEV = !global.__STANDALONE
const IPC_ID = 'pear'
const PLATFORM_PATH = platformDir()
const PLATFORM_BASE_URL = ensureDirURL(pathToFileURL(PLATFORM_PATH))
const PLATFORM_URL = PLATFORM_BASE_URL

const PLATFORM_DIR = toPath(PLATFORM_URL)
const PLATFORM_LOCK = toPath(new URL('pear.lock', PLATFORM_URL))

const RUNTIME_EXEC = isWindows ? 'pear-runtime.exe' : 'pear-runtime'

exports.LOCALDEV = LOCALDEV

exports.UPGRADE = pkg.upgrade
exports.VERSION = pkg.version

exports.PLATFORM_DIR = PLATFORM_DIR
exports.PLATFORM_LOCK = PLATFORM_LOCK
exports.PLATFORM_HYPERDB = toPath(new URL('db', PLATFORM_URL))
exports.GC = toPath(new URL('gc', PLATFORM_URL))
exports.PLATFORM_CORESTORE = toPath(new URL('corestores/platform', PLATFORM_URL))
exports.SOCKET_PATH = isWindows
  ? `\\\\.\\pipe\\${IPC_ID}-${pipeId(PLATFORM_DIR)}`
  : `${PLATFORM_DIR}/${IPC_ID}.sock`
exports.BOOT = require.main?.filename

exports.CONNECT_TIMEOUT = 20_000
exports.IDLE_TIMEOUT = 30_000
exports.SPINDOWN_TIMEOUT = 60_000

exports.RUNTIME = toPath(new URL(BIN + RUNTIME_EXEC, PLATFORM_URL))

exports.KNOWN_NODES_LIMIT = 100

function toPath(u) {
  return fileURLToPath(u).replace(/[/\\]$/, '') || '/'
}

function ensureDirURL(url) {
  return url.pathname.endsWith('/') ? url : new URL(url.pathname + '/', url)
}

function platformDir() {
  if (LOCALDEV) return path.join(__dirname, 'pear')
  if (global.__PEAR_DEV_ROOT) return path.join(global.__PEAR_DEV_ROOT, 'pear')
  if (isWindows) return path.join(os.homedir(), 'AppData', 'Roaming', 'pear')
  if (isLinux) return path.join(os.homedir(), '.config', 'pear')
  return path.join(os.homedir(), 'Library', 'Application Support', 'pear')
}

function pipeId(s) {
  const buf = b4a.allocUnsafe(32)
  sodium.crypto_generichash(buf, b4a.from(s))
  return b4a.toString(buf, 'hex')
}
