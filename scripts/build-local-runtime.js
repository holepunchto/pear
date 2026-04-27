#!/usr/bin/env node
'use strict'

const fs = require('fs')
const os = require('os')
const path = require('path')
const { spawnSync } = require('child_process')
const { isWindows } = require('which-runtime')

const root = path.resolve(__dirname, '..')
const host = `${os.platform()}-${os.arch()}`
const runtimeRel = path.join('by-arch', host, 'bin', isWindows ? 'pear-runtime.exe' : 'pear-runtime')
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
const checkout = require('../checkout')
const runtimeRoot = global.Bare?.argv?.[0]
  ? path.dirname(path.resolve(global.Bare.argv[0]))
  : path.resolve('.')
class API {
  static RTI = { checkout, mount: runtimeRoot }
  app = {}
  config = this.app
}
global.Pear = new API()
if (global.Bare?.argv?.[1] && /[\\\\/](boot\\.js|\\.pear-standalone-entry\\.js)$/.test(global.Bare.argv[1])) {
  global.Bare.argv.splice(1, 1)
}
require('../boot.js')
`
  )

  run('npx', ['--yes', 'bare-build', '--standalone', '--host', host, '--base', root, '--out', out, entry])

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
