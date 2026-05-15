'use strict'
const IPC = require('pear-ipc')
const crasher = require('pear-crasher')
const fs = require('bare-fs')
const path = require('bare-path')
const os = require('bare-os')
const env = require('bare-env')
const { isWindows, platform, arch } = require('which-runtime')
const { spawn: daemon } = require('bare-daemon')
const { SWAP, SOCKET_PATH, CONNECT_TIMEOUT, PLATFORM_DIR, RUNTIME } = require('pear-constants')
const context = require('./context')
const cmd = require('./cmd')
crasher('cli', SWAP)

cli()

async function cli() {
  const ipc = new IPC.Client({
    socketPath: SOCKET_PATH,
    connectTimeout: CONNECT_TIMEOUT,
    connect: tryboot
  })
  context.setIPC(ipc)
  await cmd(ipc)
}

function tryboot() {
  const argv = global.Bare?.argv || global.process.argv
  const args = ['--sidecar']
  const bootstrapArgIndex = argv.indexOf('--dht-bootstrap')
  if (bootstrapArgIndex !== -1 && argv[bootstrapArgIndex + 1]) {
    args.push('--dht-bootstrap', argv[bootstrapArgIndex + 1])
  }
  let runtime = resolveRuntimeExecutable([
    runtimeCandidateFromPlatform(),
    global.__PEAR_EXECUTABLE,
    global.Bare?.argv?.[0],
    RUNTIME
  ])
  if (!runtime) {
    const PATH = env.PATH || env.Path || ''
    throw new Error(
      `Unable to resolve pear runtime executable for sidecar spawn (cwd=${safeCwd() || 'n/a'}, PATH=${PATH || 'n/a'})`
    )
  }
  daemon(runtime, args, { cwd: resolveSpawnCwd(runtime) })
}

function runtimeCandidateFromPlatform() {
  const host = `${platform}-${arch}`
  const bin = path.join(PLATFORM_DIR, 'by-arch', host, 'bin')
  return path.join(bin, isWindows ? 'pear.exe' : 'pear')
}

function resolveRuntimeExecutable(candidates) {
  for (const candidate of candidates) {
    if (!candidate) continue
    const direct = resolveDirect(candidate)
    if (direct) return direct
    const fromPath = resolveFromPath(candidate)
    if (fromPath) return fromPath
    const fromKnownBins = resolveFromKnownBins(candidate)
    if (fromKnownBins) return fromKnownBins
  }
  return null
}

function resolveDirect(p) {
  try {
    const abs = path.isAbsolute(p) ? p : path.resolve(os.cwd(), p)
    if (!fs.existsSync(abs)) return null
    try {
      return fs.realpathSync(abs)
    } catch {
      return abs
    }
  } catch {
    return null
  }
}

function resolveFromPath(bin) {
  if (!bin || bin.includes('/') || bin.includes('\\')) return null
  const PATH = env.PATH || env.Path || ''
  if (!PATH) return null
  const dirs = PATH.split(isWindows ? ';' : ':').filter(Boolean)
  const names = isWindows ? [bin, `${bin}.exe`, `${bin}.cmd`, `${bin}.bat`] : [bin]
  for (const dir of dirs) {
    for (const name of names) {
      const candidate = path.join(dir, name)
      const resolved = resolveDirect(candidate)
      if (resolved) return resolved
    }
  }
  return null
}

function resolveFromKnownBins(bin) {
  if (!bin || bin.includes('/') || bin.includes('\\')) return null
  const dirs = isWindows
    ? [
        path.join(os.homedir(), 'AppData', 'Local', 'Microsoft', 'WindowsApps'),
        'C:\\Program Files\\pear\\bin'
      ]
    : [
        '/usr/local/bin',
        '/opt/homebrew/bin',
        '/usr/bin'
      ]
  const names = isWindows ? [bin, `${bin}.exe`, `${bin}.cmd`, `${bin}.bat`] : [bin]
  for (const dir of dirs) {
    for (const name of names) {
      const candidate = path.join(dir, name)
      const resolved = resolveDirect(candidate)
      if (resolved) return resolved
    }
  }
  return null
}

function safeCwd() {
  try {
    return os.cwd()
  } catch {
    return null
  }
}

function resolveSpawnCwd(runtime) {
  const ensured = ensureDir(PLATFORM_DIR)
  if (ensured) return ensured

  const fallback = path.join(path.dirname(runtime), 'pear')
  return ensureDir(fallback) || path.dirname(runtime)
}

function ensureDir(dir) {
  try {
    if (fs.existsSync(dir) === false) fs.mkdirSync(dir, { recursive: true })
    const stat = fs.statSync(dir)
    return stat.isDirectory() ? dir : null
  } catch {
    return null
  }
}
