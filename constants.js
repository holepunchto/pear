'use strict'
const sodium = require('sodium-native')
const { isWindows, isLinux } = require('which-runtime')
const { fileURLToPath, pathToFileURL } = require('url-file-url')
const path = require('bare-path')
const os = require('bare-os')
const b4a = require('b4a')
const pkg = require('./package.json')

const BIN = 'out/make/'
const IPC_ID = 'pear'
const RUNTIME_EXEC = isWindows ? 'pear-runtime.exe' : 'pear-runtime'
const dir = (p) => toPath(new URL(p, platformUrl()))

let _channel = null
let _standalone = null
let _pearDevRoot = null
let _platformDir = null
let _platformLock = null
let _platformCorestore = null
let _sidecarLogPath = null
let _gc = null
let _runtime = null
let _socketPath = null

module.exports = {
  VERSION: pkg.version,
  CONNECT_TIMEOUT: 20_000,
  SPINDOWN_TIMEOUT: 60_000,
  KNOWN_NODES_LIMIT: 100,
  get LOCALDEV() {
    return !_standalone
  },
  get UPGRADE() {
    if (_channel === null) throw new Error('UPGRADE read before init()')
    return pkg.upgrade[_channel]
  },
  get PEAR_DEV_ROOT() {
    return _pearDevRoot
  },
  get PLATFORM_DIR() {
    return _platformDir
  },
  get PLATFORM_LOCK() {
    return _platformLock
  },
  get PLATFORM_CORESTORE() {
    return _platformCorestore
  },
  get SIDECAR_LOG_PATH() {
    return _sidecarLogPath
  },
  get GC() {
    return _gc
  },
  get RUNTIME() {
    return _runtime
  },
  get SOCKET_PATH() {
    return _socketPath
  },
  init(channel, standalone, pearDevRoot) {
    const valid = ['production', 'stage', 'dev']
    if (_channel !== null) throw new Error('channel already set')
    if (!valid.includes(channel)) throw new Error(`invalid channel: ${channel}`)

    _channel = channel
    _standalone = standalone
    _pearDevRoot = pearDevRoot
    _platformDir = toPath(platformUrl())
    _platformLock = dir('pear.lock')
    _platformCorestore = dir('corestores/platform-next')
    _sidecarLogPath = dir('sidecar.log')
    _gc = dir('gc')
    _runtime = dir(BIN + RUNTIME_EXEC)
    _socketPath = isWindows
      ? `\\\\.\\pipe\\${IPC_ID}-${pipeId(_platformDir)}`
      : `${_platformDir}/${IPC_ID}.sock`
  }
}

function platformUrl() {
  const p = platformDir()
  const u = pathToFileURL(p)
  return u.pathname.endsWith('/') ? u : new URL(u.pathname + '/', u)
}

function platformDir() {
  if (!_standalone) return path.join(__dirname, 'pear')
  if (_pearDevRoot) return path.join(_pearDevRoot, 'pear')
  if (isWindows) return path.join(os.homedir(), 'AppData', 'Roaming', 'pear')
  if (isLinux) return path.join(os.homedir(), '.config', 'pear')
  return path.join(os.homedir(), 'Library', 'Application Support', 'pear')
}

function toPath(u) {
  return fileURLToPath(u).replace(/[/\\]$/, '') || '/'
}

function pipeId(s) {
  const buf = b4a.allocUnsafe(32)
  sodium.crypto_generichash(buf, b4a.from(s))
  return b4a.toString(buf, 'hex')
}
