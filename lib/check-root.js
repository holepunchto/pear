const process = require('bare-process')
const fs = require('bare-fs')
const { PLATFORM_DIR } = require('../constants')
const { isWindows } = require('which-runtime')

function checkRoot () {
  if (isWindows) return

  const ownerIsRoot = fs.statSync(PLATFORM_DIR).uid === 0
  const currentUserIsRoot = process.env.USER === 'root' // replace with process.getuid() if/when it's available

  if (currentUserIsRoot && !ownerIsRoot) {
    throw new Error('The current user is root, but the platform directory is not owned by root.')
  }
}

module.exports = checkRoot
