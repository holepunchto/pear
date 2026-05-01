'use strict'
const path = require('bare-path')
const checkout = require('../checkout')

const runtimeRoot = global.Bare?.argv?.[0]
  ? path.dirname(path.resolve(global.Bare.argv[0]))
  : path.resolve('.')

class API {
  static RTI = { checkout, mount: runtimeRoot }
  app = {}
  config = this.app
}

global.Pear = new API()

if (global.Bare?.argv?.[1] && /[\\/](boot\.js|standalone-entry\.js)$/.test(global.Bare.argv[1])) {
  global.Bare.argv.splice(1, 1)
}

require('../boot.js')
