'use strict'
const path = require('bare-path')
const fs = require('bare-fs')
const os = require('bare-os')
const { platform, arch, isWindows, isLinux } = require('which-runtime')
const { init } = require('./constants.js')

const executable = resolveExecutable()
const devRoot = resolveDevRoot(executable)

module.exports = (channel) => {
  init(channel, true, devRoot)
  migrateMisplacedPlatformState()
  require('./boot.js')
}

function resolveExecutable() {
  const executable = os.execPath()
  if (!executable) {
    throw new Error('Unable to resolve runtime executable from execPath')
  }
  return executable
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
    try {
      fs.rmdirSync(wrongRoot)
    } catch {}
    try {
      fs.rmdirSync(wrongBinRoot)
    } catch {}
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
        try {
          fs.rmdirSync(src)
        } catch {}
      } else {
        if (!fs.existsSync(dst)) fs.renameSync(src, dst)
      }
    } catch {}
  }
}

function platformDir() {
  if (devRoot) return path.join(devRoot, 'pear')
  if (isWindows) return path.join(os.homedir(), 'AppData', 'Roaming', 'pear')
  if (isLinux) return path.join(os.homedir(), '.config', 'pear')
  return path.join(os.homedir(), 'Library', 'Application Support', 'pear')
}

function normalize(p) {
  return p.replace(/\\/g, '/')
}
