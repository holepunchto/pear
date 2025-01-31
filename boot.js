/** @typedef {import('pear-interface')} */
'use strict'
class API {
  static RTI = { checkout: require('./checkout') }
  static get CONSTANTS () { return require('pear-api/constants') }
  config = {}
}
global.Pear = new API()
const BOOT_SIDECAR = 1
const BOOT_CLI = 2
switch (getBootType()) {
  case BOOT_SIDECAR: {
    require('./sidecar.js')
    break
  }
  case BOOT_CLI: {
    require('./cli.js')
    break
  }
}

function getBootType () {
  if (global.Bare.argv[1] === '--sidecar') return BOOT_SIDECAR
  return BOOT_CLI
}
