'use strict'
const path = require('bare-path')
const fs = require('bare-fs')
const os = require('bare-os')
const { platform, arch, isWindows, isLinux } = require('which-runtime')

global.__PEAR_MOUNT = resolveMount(global.Bare?.argv?.[0])

if (global.Bare?.argv?.[1] && /[\\/](boot\.js|standalone-entry\.js)$/.test(global.Bare.argv[1])) {
  global.Bare.argv.splice(1, 1)
}

require('../boot.js')

function resolveMount(argv0) {
  const fallback = path.resolve('.')
  if (!argv0) return legacyCurrentOr(fallback, null)

  let resolved = argv0
  try {
    resolved = fs.realpathSync(path.resolve(argv0))
  } catch {
    resolved = path.resolve(argv0)
  }

  const host = `${platform}-${arch}`
  const suffix = path.join('by-arch', host, 'bin')
  const binDir = path.dirname(resolved)
  const normalized = normalize(binDir)
  const normalizedSuffix = normalize(suffix)

  if (normalized.endsWith(normalizedSuffix)) {
    const trim = normalized.length - normalizedSuffix.length
    const root = trim > 0 ? normalized.slice(0, trim) : '/'
    return root.endsWith('/') && root !== '/' ? root.slice(0, -1) : root
  }

  return legacyCurrentOr(path.dirname(path.resolve(argv0)), resolved)
}

function normalize(p) {
  return p.replace(/\\/g, '/').replace(/\/+$/, '')
}

function legacyCurrentOr(fallback, runtime) {
  const dir = platformDir()
  try {
    fs.mkdirSync(dir, { recursive: true })
  } catch {}
  const legacyCurrent = path.join(dir, 'current')
  try {
    if (fs.statSync(legacyCurrent).isDirectory()) return legacyCurrent
  } catch {}
  if (runtime) {
    try {
      const host = `${platform}-${arch}`
      const binDir = path.join(legacyCurrent, 'by-arch', host, 'bin')
      fs.mkdirSync(binDir, { recursive: true })
      linkRuntime(runtime, binDir)
      return legacyCurrent
    } catch {}
  }
  return fallback
}

function linkRuntime(runtime, binDir) {
  if (isWindows) {
    const runtimeExe = path.join(binDir, 'pear-runtime.exe')
    const pearExe = path.join(binDir, 'pear.exe')
    if (!fs.existsSync(runtimeExe)) fs.copyFileSync(runtime, runtimeExe)
    if (!fs.existsSync(pearExe)) fs.copyFileSync(runtime, pearExe)
    return
  }

  const runtimeLink = path.join(binDir, 'pear-runtime')
  const pearLink = path.join(binDir, 'pear')
  try { fs.rmSync(runtimeLink, { force: true }) } catch {}
  try { fs.rmSync(pearLink, { force: true }) } catch {}
  fs.symlinkSync(runtime, runtimeLink)
  fs.symlinkSync(runtime, pearLink)
  try { fs.chmodSync(runtimeLink, 0o775) } catch {}
  try { fs.chmodSync(pearLink, 0o775) } catch {}
}

function platformDir() {
  if (isWindows) return path.join(os.homedir(), 'AppData', 'Roaming', 'pear')
  if (isLinux) return path.join(os.homedir(), '.config', 'pear')
  return path.join(os.homedir(), 'Library', 'Application Support', 'pear')
}
