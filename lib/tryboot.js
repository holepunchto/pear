'use strict'
const { isBare } = require('which-runtime')
const { spawn } = isBare ? require('bare-subprocess') : require('child_process')
const { RUNTIME, PLATFORM_DIR } = require('../constants.js')

module.exports = function tryboot () {
  const verbose = (global.Bare || global.process).argv.includes('--verbose')
  const args = ['--sidecar']
  const dhtBootstrap = Bare.argv.includes('--dht-bootstrap') ? Bare.argv[Bare.argv.indexOf('--dht-bootstrap') + 1] : null
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
