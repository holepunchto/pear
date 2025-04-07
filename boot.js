/** @typedef {import('pear-interface')} */
'use strict'
const { isWindows } = require('which-runtime')

class API {
  static RTI = { checkout: require('./checkout') }
  static CONSTANTS = null
  config = {}
}
global.Pear = new API()

const constants = require('pear-api/constants')
API.CONSTANTS = constants

if (isWindows === false) {
  const fs = require('bare-fs')
  const os = require('bare-os')

  const ownerUid = fs.statSync(constants.PLATFORM_DIR).uid
  const userUid = os.userInfo().uid

  if (ownerUid !== userUid) {
    const err = new Error(`Current user does not own ${constants.PLATFORM_DIR}`)
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
