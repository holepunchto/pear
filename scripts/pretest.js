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
    path.join(root, 'test', 'fixtures', 'harness', 'node_modules')
  ]
  for (const dir of dirs) {
    if (force === false && await exists(dir)) continue
    console.log(force ? 'reinstalling node_modules in' : 'node_modules not found in', path.dirname(dir))
    console.log('Running npm install...')
    await run('npm', ['install'], { stdio: 'inherit', cwd: path.dirname(dir), shell: isWindows })
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

function run (cmd, args, opts) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, opts)
    child.on('close', (code, signal) => {
      if (!signal && (code === 0 || code === null)) {
        resolve()
      } else {
        const reason = signal ? `due to signal: ${signal}` : `with code ${code}`
        reject(new Error(`Command '${cmd} ${args.join(' ')}' failed ${reason}`))
      }
    })
  })
}

module.exports = install().catch(console.error)
