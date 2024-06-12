'use strict'
const os = require('os')
const fs = require('fs')
const path = require('path')
const { spawn } = require('child_process')
const { isWindows, platform, arch } = require('which-runtime')
const Localdrive = require('localdrive')

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

const verbose = (global.Bare || global.process).argv.includes('--verbose')

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

  const osTmpDir = await fs.promises.realpath(os.tmpdir())
  const localdev = path.join(__dirname, '..')
  const tmpLocaldev = path.join(osTmpDir, 'tmp-localdev')

  console.log('mirroring platform')
  console.log('src', localdev)
  console.log('dst', tmpLocaldev)
  const srcDrive = new Localdrive(localdev)
  const destDrive = new Localdrive(tmpLocaldev)
  const mirror = srcDrive.mirror(destDrive, {
    filter: (key) => {
      return !key.startsWith('.git')
    }
  })
  await mirror.done()
  console.log('mirroring done')

  const store = path.join(os.tmpdir(), 'pear-test')
  const args = ['run', '--store', store, 'test']
  if (verbose) args.push('--verbose')

  await run(pear, args, { stdio: 'inherit', shell: isWindows })
})()
