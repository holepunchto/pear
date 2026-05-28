#!/usr/bin/env node
'use strict'

const fs = require('fs')
const path = require('path')
const os = require('os')

const root = path.resolve(__dirname, '..')
const arch = os.arch()
const runtimeRel = path.join('by-arch', `win32-${arch}`, 'bin', 'pear.exe')
const runtime = path.join(root, runtimeRel)
const ps1 = path.join(root, 'pear.ps1')

if (!fs.existsSync(runtime)) {
  console.error(`Missing Windows standalone executable: ${runtime}`)
  process.exit(1)
}

fs.rmSync(ps1, { force: true })
fs.writeFileSync(ps1, `& "$PSScriptRoot\\${runtimeRel}" @args\r\n`)
