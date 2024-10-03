'use strict'
const { isBare } = require('which-runtime')
const { spawn } = isBare ? require('bare-subprocess') : require('child_process')
const { RUNTIME, PLATFORM_DIR } = require('../constants.js')

module.exports = function tryboot () {
  const verbose = (global.Bare || global.process).argv.includes('--verbose')
  const args = ['--sidecar']
  const bootstrap = Bare.argv.includes('--bootstrap') ? Bare.argv[Bare.argv.indexOf('--bootstrap') + 1] : null
  if (verbose) args.push('--verbose')
  if (bootstrap) {
    args.push('--bootstrap')
    args.push(bootstrap)
  }
  const sc = spawn(RUNTIME, args, {
    detached: !verbose,
    stdio: verbose ? 'inherit' : 'ignore',
    cwd: PLATFORM_DIR
  })

  sc.unref()
}
