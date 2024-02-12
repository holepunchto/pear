'use strict'
const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')

const root = path.join(__dirname, '..')

const dirs = [
  path.join(root, 'test', 'node_modules'),
  path.join(root, 'test', 'fixtures', 'terminal', 'node_modules')
]

for (const dir of dirs) {
  if (!fs.existsSync(dir)) {
    console.log(`node_modules not found in ${path.dirname(dir)}\nRunning npm install...`)
    const cwd = path.dirname(dir)
    console.log('cwd:', cwd)
    execSync('npm install', { stdio: 'inherit', cwd: path.dirname(dir) })
  }
}
