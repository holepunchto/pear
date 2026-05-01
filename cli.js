'use strict'
const IPC = require('pear-ipc')
const API = require('pear-api')
const crasher = require('pear-crasher')
const fs = require('bare-fs')
const path = require('bare-path')
const os = require('bare-os')
const { isWindows } = require('which-runtime')
const { spawn: daemon } = require('bare-daemon')
const { SWAP, SOCKET_PATH, CONNECT_TIMEOUT, PLATFORM_DIR } = require('pear-constants')
const cmd = require('./cmd')
crasher('cli', SWAP)

cli()

async function cli() {
  const ipc = new IPC.Client({
    socketPath: SOCKET_PATH,
    connectTimeout: CONNECT_TIMEOUT,
    connect: tryboot
  })
  global.Pear.constructor.RUNTIME = global.Bare?.argv?.[0] || API.RUNTIME
  global.Pear.constructor.RUNTIME_ARGV = API.RUNTIME_ARGV
  global.Pear.constructor.RUNTIME_FLAGS = API.RUNTIME_FLAGS
  global.Pear.constructor.IPC = API.IPC
  global.Pear[global.Pear.constructor.IPC] = ipc
  await cmd(ipc)
}

function tryboot() {
  const argv = global.Bare?.argv || global.process.argv
  const args = ['--sidecar']
  const bootstrapArgIndex = argv.indexOf('--dht-bootstrap')
  if (bootstrapArgIndex !== -1 && argv[bootstrapArgIndex + 1]) {
    args.push('--dht-bootstrap', argv[bootstrapArgIndex + 1])
  }
  let runtime = global.Bare?.argv?.[0] || API.RUNTIME
  if (isWindows) runtime = resolveWindowsSidecarRuntime(runtime)
  if (!path.isAbsolute(runtime)) runtime = path.resolve(os.cwd(), runtime)
  daemon(runtime, args, { cwd: resolveSpawnCwd(runtime) })
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
