/** @typedef {import('pear-interface')} */
'use strict'
const { isWindows } = require('which-runtime')
const bootstrapRTI = require('./rti-bootstrap')
const { normalizeBareArgv } = require('./argv')
bootstrapRTI(global.__PEAR_MOUNT || null)
normalizeBareArgv()
const CONSTANTS = require('pear-constants')

{
  const fs = require('bare-fs')
  if (fs.existsSync(CONSTANTS.PLATFORM_DIR) === false) {
    fs.mkdirSync(CONSTANTS.PLATFORM_DIR, { recursive: true })
  }

  if (isWindows === false) {
    const os = require('bare-os')
    const stat = fs.statSync(CONSTANTS.PLATFORM_DIR)
    const user = os.userInfo()

    if (stat.uid !== user.uid) {
      const err = new Error(`Current user does not own ${CONSTANTS.PLATFORM_DIR}`)
      err.name = 'User Permissions Error'
      throw err
    }
  }
}

const Logger = require('pear-logger')
global.LOG = new Logger({
  labels: Logger.switches.log ? ['internal', 'sidecar'] : ['internal'],
  pretty: Logger.switches.log
})

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

function getBootType() {
  if (global.Bare.argv[1] === '--sidecar') return BOOT_SIDECAR
  return BOOT_CLI
}
