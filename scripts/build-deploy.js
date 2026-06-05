'use strict'

const { spawn } = require('bare-subprocess')

const hosts = ['darwin-arm64', 'darwin-x64', 'linux-arm64', 'linux-x64', 'win32-arm64', 'win32-x64']
const args = ['--package', './package.json', '--target', './out/build']

for (const host of hosts) {
  const app = `./by-arch/${host}/bin/pear${host.startsWith('win32-') ? '.exe' : ''}`
  args.push(`--${host}-app`, app)
}

const child = spawn('pear-build', args, { stdio: 'inherit', shell: true })

child.on('exit', (code, signal) => {
  Bare.exitCode = signal ? 128 + signal : code
})
