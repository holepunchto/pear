'use strict'
const sodium = require('sodium-native')
const { platform, arch, isWindows, isLinux } = require('which-runtime')
const { fileURLToPath, pathToFileURL } = require('url-file-url')
const path = require('bare-path')
const os = require('bare-os')
const b4a = require('b4a')
const pkg = require('./package.json')

const BIN = 'by-arch/' + platform + '-' + arch + '/bin/'
const IPC_ID = 'pear'
const RUNTIME_EXEC = isWindows ? 'pear-runtime.exe' : 'pear-runtime'

const url = (p) => new URL(p, platformUrl())
const dir = (p) => toPath(url(p))

let channel = null
let standalone = null
let pearDevRoot = null

module.exports = {
  VERSION: pkg.version,
  BOOT: require.main?.filename,
  CONNECT_TIMEOUT: 20_000,
  IDLE_TIMEOUT: 30_000,
  SPINDOWN_TIMEOUT: 60_000,
  KNOWN_NODES_LIMIT: 100,
  get LOCALDEV() {
    return !standalone
  },
  get UPGRADE() {
    if (channel === null) throw new Error('UPGRADE read before init()')
    return pkg.upgrade[channel]
  },
  get PEAR_DEV_ROOT() {
    return pearDevRoot
  },
  get PLATFORM_DIR() {
    return toPath(platformUrl())
  },
  get PLATFORM_LOCK() {
    return dir('pear.lock')
  },
  get PLATFORM_HYPERDB() {
    return dir('db')
  },
  get PLATFORM_CORESTORE() {
    return dir('corestores/platform')
  },
  get GC() {
    return dir('gc')
  },
  get RUNTIME() {
    return dir(BIN + RUNTIME_EXEC)
  },
  get SOCKET_PATH() {
    const d = toPath(platformUrl())
    return isWindows ? `\\\\.\\pipe\\${IPC_ID}-${pipeId(d)}` : `${d}/${IPC_ID}.sock`
  },
  init: (initChannel, initStandalone, initPearDevRoot) => {
    const valid = ['production', 'stage', 'dev']
    if (channel !== null) throw new Error('channel already set')
    if (!valid.includes(initChannel)) throw new Error(`invalid channel: ${initChannel}`)
    channel = initChannel
    standalone = initStandalone
    pearDevRoot = initPearDevRoot
  }
}

function platformUrl() {
  const p = platformDir()
  const u = pathToFileURL(p)
  return u.pathname.endsWith('/') ? u : new URL(u.pathname + '/', u)
}

function platformDir() {
  if (!standalone) return path.join(__dirname, 'pear')
  if (pearDevRoot) return path.join(pearDevRoot, 'pear')
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
