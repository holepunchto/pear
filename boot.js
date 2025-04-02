/** @typedef {import('pear-interface')} */
'use strict'
const { isWindows } = require('which-runtime')

class API {
  static RTI = { checkout: require('./checkout') }
  static get CONSTANTS () { return require('pear-api/constants') }
  config = {}
}
global.Pear = new API()

if (isWindows === false) {
  const fs = require('bare-fs')
  const os = require('bare-os')
  const { PLATFORM_DIR } = API.CONSTANTS

  const ownerUid = fs.statSync(PLATFORM_DIR).uid
  const userUid = os.userInfo().uid

  if (ownerUid !== userUid) {
    const err = new Error(`Current user does not own ${PLATFORM_DIR}`)
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
