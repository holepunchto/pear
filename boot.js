/** @typedef {import('pear-interface')} */
'use strict'
const { isWindows } = require('which-runtime')

class API {
  static RTI = { checkout: require('./checkout') }
  static CONSTANTS = null
  config = {}
}
global.Pear = new API()
API.CONSTANTS = require('pear-api/constants')

if (isWindows === false) {
  const fs = require('bare-fs')
  const os = require('bare-os')

  const stat = fs.statSync(API.CONSTANTS.PLATFORM_DIR)
  const user = os.userInfo()

  if (stat.uid !== user.uid) {
    const err = new Error(`Current user does not own ${API.CONSTANTS.PLATFORM_DIR}`)
    err.name = 'User Permissions Error'
    throw err
  }
}

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
