'use strict'
const IPC = require('pear-ipc')
const setupCrashHandlers = require('./lib/crasher.js')
const fs = require('bare-fs')
const path = require('bare-path')
const os = require('bare-os')
const { spawn: daemon } = require('bare-daemon')
const { SOCKET_PATH, CONNECT_TIMEOUT, PLATFORM_DIR, LOCALDEV } = require('./constants.js')
const context = require('./context')
const cmd = require('./cmd')
const { normalizedArgv } = require('./argv')

setupCrashHandlers('cli')

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
  const argv = normalizedArgv
  const args = ['--sidecar']
  const bootstrapArgIndex = argv.indexOf('--dht-bootstrap')
  if (bootstrapArgIndex !== -1 && argv[bootstrapArgIndex + 1]) {
    args.push('--dht-bootstrap', argv[bootstrapArgIndex + 1])
  }
  const runtime = os.execPath()
  if (!runtime) {
    throw new Error(
      `Unable to resolve pear runtime executable for sidecar spawn (cwd=${safeCwd() || 'n/a'})`
    )
  }
  if (LOCALDEV) args.unshift(argv[0])
  daemon(runtime, args, { cwd: resolveSpawnCwd(runtime) })
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
