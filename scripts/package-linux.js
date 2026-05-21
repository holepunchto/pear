#!/usr/bin/env node
'use strict'

const fs = require('fs')
const path = require('path')
const os = require('os')
const { run } = require('./lib/run')

const root = path.resolve(__dirname, '..')
const pkg = require(path.join(root, 'package.json'))

const host = process.argv[2] || `${os.platform()}-${os.arch()}`
if (host !== 'linux-x64' && host !== 'linux-arm64') {
  console.error(`Unsupported linux host: ${host}`)
  process.exit(1)
}

const productName = pkg.productName || pkg.name
const outRoot = path.join(root, 'out', 'make', host)
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pear-make-'))

fs.rmSync(outRoot, { recursive: true, force: true })
fs.mkdirSync(outRoot, { recursive: true })

try {
  run(
    'bare-build',
    [
      '--package',
      '--base',
      '.',
      '--name',
      productName,
      '--description',
      pkg.description || 'Pear runtime command line interface',
      '--host',
      host,
      '--out',
      tmpDir,
      'scripts/standalone-entry.js'
    ],
    {
      cwd: root,
      env: { ...process.env, APPIMAGE_EXTRACT_AND_RUN: '1' }
    }
  )

  const appImage = path.join(tmpDir, `${productName}.AppImage`)
  if (!fs.existsSync(appImage)) {
    const found = fs.readdirSync(tmpDir).join(', ')
    throw new Error(`Expected ${appImage} after bare-build --package; got: ${found}`)
  }

  const target = path.join(outRoot, `${productName}-${host}.AppImage`)
  fs.renameSync(appImage, target)
  fs.chmodSync(target, 0o755)
  console.log(`wrote ${path.relative(root, target)}`)
} finally {
  fs.rmSync(tmpDir, { recursive: true, force: true })
}
