'use strict'
const { isBare } = require('which-runtime')
const { spawn } = isBare ? require('bare-subprocess') : require('child_process')
const { RUNTIME, PLATFORM_DIR } = require('../constants.js')

module.exports = function tryboot () {
  const { argv } = global.Bare || global.process
  const flags = require('./platform-flags')(argv.slice(2), !!global.process)
  const args = ['--sidecar']
  let detached = true
  if (flags.log) {
    args.push('--log')
    detached = false
  } else {
    const { length } = args
    if (flags.logLevel) args.push('--log-level', flags.logLevel)
    if (flags.logFields) args.push('--log-fields', flags.logFields)
    if (flags.logLabels) args.push('--log-labels', flags.logLabels)
    if (args.length > length) detached = false
  }
  if (flags.logStacks) args.push('--log-stacks')
  if (flags.dhtBootstrap) args.push('--dht-bootstrap', flags.dhtBootstrap)
  const sc = spawn(RUNTIME, args, { detached, stdio: detached ? 'ignore' : 'inherit', cwd: PLATFORM_DIR })
  sc.unref()
}
