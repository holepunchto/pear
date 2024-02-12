'use strict'
const fs = require('fs')
const path = require('path')
const { spawn } = require('child_process')

const IS_WINDOWS = (global.Bare?.platform || global.process.platform) === 'win32'

const root = path.join(__dirname, '..')

const dirs = [
  path.join(root, 'test', 'node_modules'),
  path.join(root, 'test', 'fixtures', 'terminal', 'node_modules')
]

const exists = async (path) => {
  try {
    await fs.promises.access(path)
    return true
  } catch {
    return false
  }
}

const run = (cmd, args, opts) => {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, opts)

    child.on('close', (code) => {
      if (code === 0) {
        resolve()
      } else {
        reject(new Error(`Command failed with code ${code}`))
      }
    })
  })
}

(async () => {
  for (const dir of dirs) {
    if (!await exists(dir)) {
      console.log(`node_modules not found in ${path.dirname(dir)}\nRunning npm install...`)
      await run('npm', ['install'], { stdio: 'inherit', cwd: path.dirname(dir) })
    }
  }

  if (IS_WINDOWS) {
    await run('pear.cmd', ['run', 'test'], { stdio: 'inherit', shell: true })
  } else {
    await run('./pear.dev', ['run', 'test'], { stdio: 'inherit' })
  }
})()
