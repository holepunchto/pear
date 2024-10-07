'use strict'
const { isBare } = require('which-runtime')
const { spawn } = isBare ? require('bare-subprocess') : require('child_process')
const { RUNTIME, PLATFORM_DIR } = require('../constants.js')

module.exports = function tryboot () {
  const { argv } = global.Bare || global.process
  const verbose = argv.includes('--verbose')
  const args = ['--sidecar']
  const dhtBootstrap = argv.includes('--dht-bootstrap') ? argv[argv.indexOf('--dht-bootstrap') + 1] : null
  if (verbose) args.push('--verbose')
  if (dhtBootstrap) {
    args.push('--dht-bootstrap')
    args.push(dhtBootstrap)
  }
  const sc = spawn(RUNTIME, args, {
    detached: !verbose,
    stdio: verbose ? 'inherit' : 'ignore',
    cwd: PLATFORM_DIR
  })

  sc.unref()
}
