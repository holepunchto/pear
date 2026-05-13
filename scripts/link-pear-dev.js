#!/usr/bin/env node
'use strict'

const fs = require('fs')
const path = require('path')
const os = require('os')
const { isWindows } = require('which-runtime')

if (isWindows) process.exit(0)

const root = path.resolve(__dirname, '..')
const host = `${os.platform()}-${os.arch()}`
const runtimeRel = path.join('by-arch', host, 'bin', 'pear-runtime')
const runtimeAbs = path.join(root, runtimeRel)
const devLink = path.join(root, 'pear.dev')

if (!fs.existsSync(runtimeAbs)) {
  process.exit(0)
}

try { fs.rmSync(devLink, { force: true }) } catch {}
fs.symlinkSync(runtimeRel, devLink)
fs.chmodSync(devLink, 0o775)
console.log(`Linked ${devLink} -> ${runtimeRel}`)
