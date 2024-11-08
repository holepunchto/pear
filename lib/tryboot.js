'use strict'
const { isBare } = require('which-runtime')
const { spawn } = isBare ? require('bare-subprocess') : require('child_process')
const { RUNTIME, PLATFORM_DIR } = require('../constants.js')

module.exports = function tryboot () {
  const { argv } = global.Bare || global.process
  const { flags = {} } = require('../shell')(argv.slice(1)) ?? {}
  const args = ['--sidecar']
  const dhtBootstrap = argv.includes('--dht-bootstrap') ? argv[argv.indexOf('--dht-bootstrap') + 1] : null
  if (dhtBootstrap) {
    args.push('--dht-bootstrap')
    args.push(dhtBootstrap)
  }

  let detached = true
  const { length } = args
  if (flags.log) args.push('--log')
  if (flags.logLevel) args.push('--log-level', flags.logLevel)
  if (flags.logFields) args.push('--log-fields', flags.logFields)
  if (flags.logLabels) args.push('--log-labels', flags.logLabels)
  if (flags.logStacks) args.push('--log-stacks')
  if (args.length > length) detached = false
  
  const sc = spawn(RUNTIME, args, { detached, stdio: detached ? 'ignore' : 'inherit', cwd: PLATFORM_DIR })
  sc.unref()
}
