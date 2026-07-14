'use strict'
const IPC = require('pear-ipc')
const crasher = require('./lib/crasher.js')
const fs = require('bare-fs')
const path = require('bare-path')
const os = require('bare-os')
const { spawn: daemon } = require('bare-daemon')
const { SOCKET_PATH, CONNECT_TIMEOUT, PLATFORM_DIR, LOCALDEV } = require('./constants.js')
const context = require('./context')
const cmd = require('./cmd')
const { cmdArgs, normalizedArgv } = require('./argv')
crasher('cli')

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
  const args = ['--sidecar', ...forwardSidecarArgs(cmdArgs)]
  const runtime = os.execPath()
  if (!runtime) {
    throw new Error(
      `Unable to resolve pear runtime executable for sidecar spawn (cwd=${safeCwd() || 'n/a'})`
    )
  }
  if (LOCALDEV) args.unshift(normalizedArgv[0])
  daemon(runtime, args, { cwd: resolveSpawnCwd(runtime) })
}

function forwardSidecarArgs(argv) {
  const valueFlags = new Set([
    '--dht-bootstrap',
    '--log-fields',
    '-F',
    '--log-file',
    '--log-labels',
    '-l',
    '--log-level',
    '-L'
  ])
  const boolFlags = new Set([
    '--log',
    '--log-max',
    '-M',
    '--log-stacks',
    '-S',
    '--log-verbose',
    '-V'
  ])
  const forwarded = []

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === '--') break
    if (boolFlags.has(arg)) forwarded.push(arg)
    else if (valueFlags.has(arg) && argv[i + 1]) forwarded.push(arg, argv[++i])
    else if (arg.startsWith('--dht-bootstrap=')) forwarded.push(arg)
    else if (arg.startsWith('--log-fields=')) forwarded.push(arg)
    else if (arg.startsWith('--log-file=')) forwarded.push(arg)
    else if (arg.startsWith('--log-labels=')) forwarded.push(arg)
    else if (arg.startsWith('--log-level=')) forwarded.push(arg)
  }

  return forwarded
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
