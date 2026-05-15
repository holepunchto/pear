'use strict'
const IPC = require('pear-ipc')
const crasher = require('pear-crasher')
const fs = require('bare-fs')
const path = require('bare-path')
const os = require('bare-os')
const env = require('bare-env')
const { isWindows } = require('which-runtime')
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
  let runtime = resolveRuntimeExecutable(global.__PEAR_EXECUTABLE || global.Bare?.argv?.[0] || RUNTIME)
  if (isWindows) runtime = resolveWindowsSidecarRuntime(runtime)
  daemon(runtime, args, { cwd: resolveSpawnCwd(runtime) })
}

function resolveRuntimeExecutable(runtime) {
  if (!runtime) return RUNTIME
  const direct = resolveDirect(runtime)
  if (direct) return direct
  const fromPath = resolveFromPath(runtime)
  if (fromPath) return fromPath
  const fallback = resolveDirect(RUNTIME)
  return fallback || RUNTIME
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

function resolveWindowsSidecarRuntime(runtime) {
  try {
    if (!runtime) return runtime
    const source = path.isAbsolute(runtime) ? runtime : path.resolve(os.cwd(), runtime)
    const sidecarRuntime = path.join(path.dirname(source), 'pear-sidecar.exe')
    if (fs.existsSync(source) === false) return runtime

    const srcStat = fs.statSync(source)
    const dstExists = fs.existsSync(sidecarRuntime)
    if (dstExists) {
      const dstStat = fs.statSync(sidecarRuntime)
      if (dstStat.size === srcStat.size) return sidecarRuntime
    }

    fs.copyFileSync(source, sidecarRuntime)
    return sidecarRuntime
  } catch {
    return runtime
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
