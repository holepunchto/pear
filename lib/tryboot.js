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
  if (flags.log) {
    args.push('--log')
    detached = false
  } else if (flags.performanceLog) {
    args.push('--performance-log')
    args.push('--log-level', flags.logLevel || '2')
    args.push('--log-fields', flags.logFields || 'date,time,level,label,delta')
    args.push('--log-labels', flags.logLabels || 'sidecar')
    detached = false
  } else {
    const { length } = args
    if (flags.logLevel) args.push('--log-level', flags.logLevel)
    if (flags.logFields) args.push('--log-fields', flags.logFields)
    if (flags.logLabels) args.push('--log-labels', flags.logLabels)
    if (args.length > length) detached = false
  }
  if (flags.logStacks) args.push('--log-stacks')
  const sc = spawn(RUNTIME, args, { detached, stdio: detached ? 'ignore' : 'inherit', cwd: PLATFORM_DIR })
  sc.unref()
}
