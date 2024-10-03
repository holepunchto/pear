'use strict'
const fs = require('bare-fs')
const path = require('bare-path')
const { spawn, spawnSync } = require('bare-subprocess')
const { isWindows } = require('which-runtime')
const { RUNTIME } = require('../constants')
const root = path.resolve(__dirname, '..')
const args = Bare.argv.slice(2)
const force = args.includes('--force-install')
if (force) args.splice(args.indexOf('--force-install'), 1)

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

const tests = spawn(RUNTIME, ['run', '-t', 'test', ...args], { cwd: root, stdio: 'inherit' })

tests.on('exit', (code) => { Bare.exitCode = code })
