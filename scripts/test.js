'use strict'
const fs = require('bare-fs')
const path = require('bare-path')
const { spawn, spawnSync } = require('bare-subprocess')
const { isWindows } = require('which-runtime')
const { RUNTIME } = require('../constants')
const { pathname } = new URL(global.Pear.config.applink)
const root = isWindows ? path.normalize(pathname.slice(1)) : pathname
const force = global.Pear.config.args.includes('--force-install')
const cwd = isWindows ? path.normalize(pathname.slice(1)) : pathname

const dirs = [
  path.join(root, 'test', 'fixtures', 'harness', 'node_modules'),
  path.join(root, 'test', 'fixtures', 'encrypted', 'node_modules')
]

for (const dir of dirs) {
  if (force === false && fs.existsSync(dir)) continue
  console.log(force ? 'reinstalling node_modules in' : 'node_modules not found in', path.dirname(dir))
  console.log('Running npm install...')
  if (isWindows) spawnSync('pwsh', ['-Command', 'npm install'], { cwd: path.dirname(dir), stdio: 'inherit' })
  else spawnSync('npm', ['install'], { cwd: path.dirname(dir), stdio: 'inherit' })
}

const tests = spawn(RUNTIME, ['run', '-t', 'test', ...global.Pear.config.args], { cwd, stdio: 'inherit' })

tests.on('exit', (code) => { Bare.exitCode = code })