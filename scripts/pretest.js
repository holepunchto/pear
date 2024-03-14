'use strict'
const fs = require('fs')
const path = require('path')
const { spawn } = require('child_process')
const { isWindows, platform, arch } = require('which-runtime')

const root = path.join(__dirname, '..')
const host = platform + '-' + arch
const pear = `by-arch/${host}/bin/pear-runtime${isWindows ? '.exe' : ''}`

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

(async () => {
  for (const dir of dirs) {
    if (!await exists(dir)) {
      console.log(`node_modules not found in ${path.dirname(dir)}\nRunning npm install...`)
      await run('npm', ['install'], { stdio: 'inherit', cwd: path.dirname(dir), shell: isWindows })
    }
  }

  await run(pear, ['run', 'test', '--attach-boot-io'], { stdio: 'inherit', shell: isWindows })
})()
