#!/usr/bin/env node
'use strict'

const fs = require('fs')
const os = require('os')
const path = require('path')
const { spawnSync } = require('child_process')
const { isWindows } = require('which-runtime')

const root = path.resolve(__dirname, '..')
const host = `${os.platform()}-${os.arch()}`
const output = path.join(root, isWindows ? 'pear.new.exe' : 'pear.new.dev')
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pear-bare-build-'))
const entry = path.join(root, 'scripts', '.pear-standalone-entry.js')
const out = path.join(tmp, 'out')

const backups = new Map()
const patch = (file, transform) => {
  if (!backups.has(file)) backups.set(file, fs.readFileSync(file, 'utf8'))
  fs.writeFileSync(file, transform(backups.get(file)))
}

const restore = () => {
  for (const [file, contents] of backups) fs.writeFileSync(file, contents)
}

const run = (cmd, args) => {
  const res = spawnSync(cmd, args, { cwd: root, stdio: 'inherit' })
  if (res.status !== 0) process.exit(res.status || 1)
}

try {
  patch(path.join(root, 'node_modules', 'pear-logger', 'package.json'), (s) => {
    const j = JSON.parse(s)
    j.imports = j.imports || {}
    j.imports.tty = { bare: 'bare-tty', default: 'tty' }
    return JSON.stringify(j, null, 2) + '\n'
  })

  patch(path.join(root, 'node_modules', 'script-linker', 'package.json'), (s) => {
    const j = JSON.parse(s)
    j.imports = j.imports || {}
    j.imports.module = { bare: 'bare-module', default: 'module' }
    return JSON.stringify(j, null, 2) + '\n'
  })

  patch(path.join(root, 'node_modules', 'pear-api', 'index.js'), (s) =>
    s.replace(
      "const electron = require('electron')",
      "const req = require\n        const electron = req('electron')"
    )
  )

  patch(path.join(root, 'node_modules', 'pear-crasher', 'index.js'), (s) =>
    s.replace(
      "global.process.versions.electron ? require('electron').app : global.process",
      "global.process.versions.electron ? (() => { const req = require; return req('electron').app })() : global.process"
    )
  )

  fs.writeFileSync(
    entry,
    `'use strict'
const os = require('bare-os')
const checkout = require('../checkout')
class API {
  static RTI = { checkout, mount: os.cwd() }
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

  fs.copyFileSync(built, output)
  if (!isWindows) fs.chmodSync(output, 0o775)
  console.log(`Built ${output}`)
} finally {
  restore()
  fs.rmSync(entry, { force: true })
  fs.rmSync(tmp, { recursive: true, force: true })
}
