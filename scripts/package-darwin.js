#!/usr/bin/env node
'use strict'

const fs = require('fs')
const path = require('path')
const os = require('os')
const { run } = require('./lib/run')

const root = path.resolve(__dirname, '..')
const pkg = require(path.join(root, 'package.json'))

const host = process.argv[2] || `${os.platform()}-${os.arch()}`
if (host !== 'darwin-arm64' && host !== 'darwin-x64') {
  console.error(`Unsupported darwin host: ${host}`)
  process.exit(1)
}

const productName = pkg.productName || pkg.name
const outRoot = path.join(root, 'out', 'make', host)
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pear-make-'))

const identity = process.env.MAC_CODESIGN_IDENTITY || ''
const keychainProfile = process.env.KEYCHAIN_PROFILE || ''
const shouldSign = Boolean(identity)
const shouldNotarize = Boolean(keychainProfile)

fs.rmSync(outRoot, { recursive: true, force: true })
fs.mkdirSync(outRoot, { recursive: true })

try {
  const appArgs = [
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
  ]

  if (shouldSign) {
    appArgs.push('--sign', '--identity', identity, '--hardened-runtime')
  }

  run('bare-build', appArgs, { cwd: root })

  const appPath = path.join(tmpDir, `${productName}.app`)
  if (!fs.existsSync(appPath)) {
    const found = fs.readdirSync(tmpDir).join(', ')
    throw new Error(`Expected ${appPath} after bare-build; got: ${found}`)
  }

  const zipPath = path.join(outRoot, `${productName}-${host}.zip`)
  run('ditto', ['-c', '-k', '--sequesterRsrc', '--keepParent', appPath, zipPath])

  if (shouldNotarize) {
    run('xcrun', ['notarytool', 'submit', zipPath, '--keychain-profile', keychainProfile, '--wait'])
    run('xcrun', ['stapler', 'staple', appPath])

    fs.rmSync(zipPath, { force: true })
    run('ditto', ['-c', '-k', '--sequesterRsrc', '--keepParent', appPath, zipPath])
  } else if (shouldSign) {
    console.warn('KEYCHAIN_PROFILE not set; skipping notarization')
  } else {
    console.warn('MAC_CODESIGN_IDENTITY not set; produced unsigned .app')
  }

  console.log(`wrote ${path.relative(root, zipPath)}`)
} finally {
  fs.rmSync(tmpDir, { recursive: true, force: true })
}
