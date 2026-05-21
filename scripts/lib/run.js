'use strict'

const os = require('os')
const { spawnSync } = require('child_process')

function run(cmd, args, opts = {}) {
  const printable = [cmd, ...args.map(quoteIfNeeded)].join(' ')
  console.log(`> ${printable}`)
  const res = spawnSync(cmd, args, { stdio: 'inherit', ...opts })
  if (res.status !== 0) {
    throw new Error(`Command failed (${res.status ?? 'signal ' + res.signal}): ${printable}`)
  }
  return res
}

function quoteIfNeeded(arg) {
  return /\s/.test(arg) ? JSON.stringify(arg) : arg
}

function shellOpts() {
  return os.platform() === 'win32' ? { shell: true } : {}
}

module.exports = { run, shellOpts }
