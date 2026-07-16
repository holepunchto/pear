/** @typedef {import('pear-interface')} */
'use strict'
const fs = require('bare-fs')
const os = require('bare-os')
const { isWindows } = require('which-runtime')
const { PLATFORM_DIR } = require('./constants.js')
const Logger = require('./lib/logger.js')
const { cmdArgs } = require('./argv')
const flags = require('./lib/cmd.js').command(cmdArgs)?.flags ?? {}

if (fs.existsSync(PLATFORM_DIR) === false) {
  fs.mkdirSync(PLATFORM_DIR, { recursive: true })
}

if (isWindows === false) {
  const stat = fs.statSync(PLATFORM_DIR)
  const user = os.userInfo()

  if (stat.uid !== user.uid) {
    const err = new Error(`Current user does not own ${PLATFORM_DIR}`)
    err.name = 'User Permissions Error'
    throw err
  }
}

const max = !!flags.logMax
const logging = !!(flags.log || flags.logLabels || max)
const labels = ['internal']
if (logging) labels.push('sidecar')
if (flags.logLabels) labels.push(...flags.logLabels.split(','))

global.LOG = new Logger({
  labels,
  level: flags.logLevel ?? (max ? 'trace' : logging ? 'info' : 'error'),
  all: max
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
  if (cmdArgs[0] === '--sidecar') return BOOT_SIDECAR
  return BOOT_CLI
}
