#!/usr/bin/env node
'use strict'

const fs = require('fs')
const os = require('os')
const path = require('path')
const { spawnSync } = require('child_process')
const { isWindows } = require('which-runtime')

const root = path.resolve(__dirname, '..')
const host = `${os.platform()}-${os.arch()}`
const runtimeRel = path.join(
  'by-arch',
  host,
  'bin',
  isWindows ? 'pear-runtime.exe' : 'pear-runtime'
)
const output = path.join(root, runtimeRel)
const devLink = path.join(root, 'pear.dev')
const ps1 = path.join(root, 'pear.ps1')
const cmd = path.join(root, 'pear.cmd')
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pear-bare-build-'))
const entry = path.join(root, 'scripts', '.pear-standalone-entry.js')
const out = path.join(tmp, 'out')

const run = (cmd, args) => {
  const res = spawnSync(cmd, args, { cwd: root, stdio: 'inherit' })
  if (res.status !== 0) process.exit(res.status || 1)
}

try {
  fs.writeFileSync(
    entry,
    `'use strict'
const path = require('bare-path')
const fs = require('bare-fs')
const os = require('bare-os')
const { platform, arch, isWindows, isLinux } = require('which-runtime')
global.__PEAR_MOUNT = resolveMount(global.Bare?.argv?.[0])
if (global.Bare?.argv?.[1] && /[\\\\/](boot\\.js|\\.pear-standalone-entry\\.js)$/.test(global.Bare.argv[1])) {
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
  const host = \`\${platform}-\${arch}\`
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
  return p.replace(/\\\\/g, '/').replace(/\\/+$/, '')
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
      const host = \`\${platform}-\${arch}\`
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
`
  )

  run('npx', [
    '--yes',
    'bare-build',
    '--standalone',
    '--host',
    host,
    '--base',
    root,
    '--out',
    out,
    entry
  ])

  const built = ['pear.exe', 'pear']
    .map((name) => path.join(out, name))
    .find((candidate) => fs.existsSync(candidate))

  if (!built) {
    console.error('Build succeeded but no output binary was found in', out)
    process.exit(1)
  }

  fs.mkdirSync(path.dirname(output), { recursive: true })
  fs.rmSync(devLink, { force: true })
  fs.rmSync(path.join(root, 'pear.new.dev'), { force: true })
  fs.rmSync(path.join(root, 'pear.new.exe'), { force: true })
  fs.copyFileSync(built, output)
  if (!isWindows) fs.chmodSync(output, 0o775)
  if (!isWindows) {
    fs.symlinkSync(runtimeRel, devLink)
    fs.chmodSync(devLink, 0o775)
  } else {
    fs.writeFileSync(ps1, `& "$PSScriptRoot\\\\${runtimeRel}" @args`)
    fs.writeFileSync(cmd, `@echo off\r\n"%~dp0${runtimeRel}" %*`)
  }
  console.log(`Built ${output}`)
} finally {
  fs.rmSync(entry, { force: true })
  fs.rmSync(tmp, { recursive: true, force: true })
}
