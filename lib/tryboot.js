'use strict'
const { isBare } = require('which-runtime')
const { spawn } = isBare ? require('bare-subprocess') : require('child_process')
const { RUNTIME, PLATFORM_DIR } = require('../constants.js')

module.exports = function tryboot () {
  const sc = spawn(RUNTIME, ['--sidecar'], {
    detached: true,
    stdio: (global.Bare || global.process).argv.includes('--verbose') ? 'inherit' : 'ignore',
    cwd: PLATFORM_DIR
  })

  sc.unref()
}
