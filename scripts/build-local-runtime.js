#!/usr/bin/env node
'use strict'

const os = require('os')
const path = require('path')
const { spawnSync } = require('child_process')

const root = path.resolve(__dirname, '..')
const host = `${os.platform()}-${os.arch()}`
const isRelease = process.env.NODE_ENV === 'production'
const script = `${isRelease ? 'make:release:' : 'make:'}${host}`
const supported = new Set(['darwin-arm64', 'darwin-x64', 'linux-arm64', 'linux-x64', 'win32-x64'])

if (!supported.has(host)) {
  console.error(`Unsupported platform/arch: ${host}`)
  console.error('Supported targets: ' + [...supported].join(', '))
  process.exit(1)
}

const res = spawnSync(`npm run ${script}`, { cwd: root, stdio: 'inherit', shell: true })
if (res.status !== 0) process.exit(res.status || 1)
