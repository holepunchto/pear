'use strict'
const path = require('bare-path')
const fs = require('bare-fs')
const os = require('bare-os')
const env = require('bare-env')
const { platform, arch, isWindows, isLinux } = require('which-runtime')

const executable = resolveExecutable(global.Bare?.argv?.[0])
const devRoot = resolveDevRoot(executable)
global.__PEAR_EXECUTABLE = executable
global.__PEAR_DEV_ROOT = devRoot
global.__PEAR_MOUNT = resolveMount()
global.__STANDALONE = true
migrateMisplacedPlatformState()

require('../boot.js')

function resolveExecutable(argv0) {
  if (!argv0) return null
  const direct = resolveExisting(safeResolveArgv(argv0))
  if (direct) return direct
  const fromPath = resolveFromPath(argv0)
  if (fromPath) return fromPath
  const fromKnownBins = resolveFromKnownBins(argv0)
  if (fromKnownBins) return fromKnownBins
  return null
}

function resolveMount() {
  const mount = global.__PEAR_DEV_ROOT ? devRootMountPath() : runtimeMountPath()
  try {
    fs.mkdirSync(mount, { recursive: true })
  } catch {}
  return mount
}

function runtimeMountPath() {
  return platformDir()
}

function devRootMountPath() {
  return global.__PEAR_DEV_ROOT || safeResolveDot()
}

function resolveDevRoot(resolvedExecutable) {
  if (!resolvedExecutable) return null
  try {
    const host = `${platform}-${arch}`
    const file = isWindows ? 'pear.exe' : 'pear'
    const suffix = normalize(path.join('by-arch', host, 'bin', file))
    const exe = normalize(resolvedExecutable)
    if (!exe.endsWith(suffix)) return null
    const trim = exe.length - suffix.length
    const root = trim > 0 ? exe.slice(0, trim).replace(/\/+$/, '') : ''
    return root || '/'
  } catch {
    return null
  }
}

function migrateMisplacedPlatformState() {
  const base = platformDir()
  const byArch = path.join(base, 'by-arch')
  let hosts = []
  try {
    hosts = fs.readdirSync(byArch)
  } catch {
    hosts = []
  }

  for (const host of hosts) {
    const wrongBinRoot = path.join(byArch, host, 'bin', 'pear')
    const wrongRoot = path.join(wrongBinRoot, 'pear')
    try {
      if (!fs.existsSync(wrongRoot)) continue
      const stat = fs.statSync(wrongRoot)
      if (!stat.isDirectory()) continue
    } catch {
      continue
    }

    for (const name of ['corestores', 'db', 'gc', 'bundles', 'applings', 'lock', 'pear.lock']) {
      const from = path.join(wrongRoot, name)
      const to = path.join(base, name)
      try {
        if (!fs.existsSync(from)) continue
        const fromStat = fs.statSync(from)
        if (fromStat.isDirectory()) {
          if (!fs.existsSync(to)) fs.mkdirSync(to, { recursive: true })
          mergeDir(from, to)
        } else {
          if (!fs.existsSync(to)) fs.renameSync(from, to)
        }
      } catch {}
    }

    // Cleanup legacy nested dirs if they are now empty.
    try { fs.rmdirSync(wrongRoot) } catch {}
    try { fs.rmdirSync(wrongBinRoot) } catch {}
  }
}

function mergeDir(from, to) {
  let entries = []
  try {
    entries = fs.readdirSync(from)
  } catch {
    return
  }
  for (const name of entries) {
    const src = path.join(from, name)
    const dst = path.join(to, name)
    try {
      const st = fs.statSync(src)
      if (st.isDirectory()) {
        if (!fs.existsSync(dst)) fs.mkdirSync(dst, { recursive: true })
        mergeDir(src, dst)
        try { fs.rmdirSync(src) } catch {}
      } else {
        if (!fs.existsSync(dst)) fs.renameSync(src, dst)
      }
    } catch {}
  }
}

function platformDir() {
  if (global.__PEAR_DEV_ROOT) return path.join(global.__PEAR_DEV_ROOT, 'pear')
  if (isWindows) return path.join(os.homedir(), 'AppData', 'Roaming', 'pear')
  if (isLinux) return path.join(os.homedir(), '.config', 'pear')
  return path.join(os.homedir(), 'Library', 'Application Support', 'pear')
}

function normalize(p) {
  return p.replace(/\\/g, '/')
}

function safeResolveArgv(argv0) {
  if (!argv0) return safeResolveDot()
  if (path.isAbsolute(argv0)) return argv0
  const cwd = safeCwd()
  return cwd ? path.join(cwd, argv0) : argv0
}

function safeResolveDot() {
  const cwd = safeCwd()
  return cwd || '/'
}

function safeCwd() {
  try {
    return os.cwd()
  } catch {
    return null
  }
}

function resolveExisting(p) {
  if (!p) return null
  try {
    if (!fs.existsSync(p)) return null
    try {
      return fs.realpathSync(p)
    } catch {
      return p
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
      const found = resolveExisting(path.join(dir, name))
      if (found) return found
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
  const names = isWindows ? [bin, `${bin}.exe`] : [bin]
  for (const dir of dirs) {
    for (const name of names) {
      const found = resolveExisting(path.join(dir, name))
      if (found) return found
    }
  }
  return null
}
