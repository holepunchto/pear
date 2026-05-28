#!/usr/bin/env node
'use strict'

const os = require('os')
const path = require('path')
const { spawnSync } = require('child_process')

const root = path.resolve(__dirname, '..')
const host = `${os.platform()}-${os.arch()}`
const script = `make:${host}`
const supported = new Set([
  'darwin-arm64',
  'darwin-x64',
  'linux-arm64',
  'linux-x64',
  'win32-arm64',
  'win32-x64'
])

if (!supported.has(host)) {
  console.error(`Unsupported platform/arch: ${host}`)
  console.error(
    'Supported targets: darwin-arm64, darwin-x64, linux-arm64, linux-x64, win32-arm64, win32-x64'
  )
  process.exit(1)
}

const isWindows = os.platform() === 'win32'
const opts = {
  cwd: root,
  stdio: 'inherit'
}
const res = isWindows
  ? spawnSync(`npm.cmd run ${script}`, { ...opts, shell: true })
  : spawnSync('npm', ['run', script], opts)
if (res.error) {
  console.error(res.error.message)
  process.exit(1)
}
if (res.status !== 0) process.exit(res.status || 1)
