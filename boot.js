/** @typedef {import('pear-interface')} */
'use strict'
const fs = require('bare-fs')
const os = require('bare-os')
const { isWindows, isLinux } = require('which-runtime')
const { PLATFORM_DIR, LOG_PATH } = require('./constants.js')
const Logger = require('./lib/logger.js')
const { cmdArgs } = require('./argv')
const flags = require('./lib/cmd.js').command(cmdArgs)?.flags ?? {}

if (fs.existsSync(PLATFORM_DIR) === false) {
  fs.mkdirSync(PLATFORM_DIR, { recursive: true })
}

if (isLinux) {
  try {
    require('rocksdb-native')
  } catch {
    console.log('The required library libatomic.so was not found on the system.')
    console.log(`
Please install it first using the appropriate package manager for your system.

- Debian/Ubuntu:   sudo apt install libatomic1
- Fedora:          sudo dnf install libatomic
- Arch Linux:      sudo pacman -S libatomic_ops
- Alpine Linux:    sudo apk add libatomic
- RHEL/CentOS:     sudo yum install libatomic
`)
    Bare.exit(1)
  }
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

global.LOG = new Logger(LOG_PATH, {
  level: flags.logLevel || 'info'
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
