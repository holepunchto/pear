'use strict'
const path = require('bare-path')
global.__PEAR_MOUNT = global.Bare?.argv?.[0]
  ? path.dirname(path.resolve(global.Bare.argv[0]))
  : path.resolve('.')

if (global.Bare?.argv?.[1] && /[\\/](boot\.js|standalone-entry\.js)$/.test(global.Bare.argv[1])) {
  global.Bare.argv.splice(1, 1)
}

require('../boot.js')
