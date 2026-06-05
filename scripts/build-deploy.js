'use strict'

const { spawn } = require('bare-subprocess')
const { platform, arch, isWindows } = require('which-runtime')

const host = `${platform}-${arch}`
const app = `./by-arch/${host}/bin/pear${isWindows ? '.exe' : ''}`

const child = spawn(
  'pear-build',
  ['--package', './package.json', `--${host}-app`, app, '--target', './out/build'],
  { stdio: 'inherit', shell: true }
)

child.on('exit', (code, signal) => {
  Bare.exitCode = signal ? 128 + signal : code
})
