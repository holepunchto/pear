'use strict'
const fs = require('bare-fs')
const path = require('bare-path')
const { spawn } = require('bare-subprocess')
const { isWindows } = require('which-runtime')

const { protocol, pathname } = new URL(global.Pear.config.applink)
const root = isWindows ? path.normalize(pathname.slice(1)) : pathname
const force = global.Pear.config.args.includes('--force-install')

async function install () {
  if (protocol !== 'file:') return
  const dirs = [
    path.join(root, 'test', 'fixtures', 'harness', 'node_modules'),
    path.join(root, 'test', 'fixtures', 'encrypted', 'node_modules')
  ]
  for (const dir of dirs) {
    if (force === false && await exists(dir)) continue
    console.log(force ? 'reinstalling node_modules in' : 'node_modules not found in', path.dirname(dir))
    console.log('Running npm install...')
    if (isWindows) spawn('pwsh', ['-Command', 'npm install'], { cwd: path.dirname(dir), stdio: 'inherit' })
    else spawn('npm', ['install'], { stdio: 'inherit', cwd: path.dirname(dir) })
  }
}

async function exists (path) {
  try {
    await fs.promises.access(path)
    return true
  } catch {
    return false
  }
}

module.exports = install()
module.exports.catch(console.error)
