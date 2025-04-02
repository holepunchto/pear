const { isWindows } = require('which-runtime')
const fs = require('bare-fs')
const { PLATFORM_DIR } = require('pear-api/constants')
const os = require('bare-os')

function checkUser () {
  if (isWindows) return

  const ownerUid = fs.statSync(PLATFORM_DIR).uid
  const userUid = os.userInfo().uid

  if (ownerUid !== userUid) {
    throw new Error('Running is not allowed when the pear platform directory is not owned by the current user. Please ensure that you are running as the correct user.')
  }
}

module.exports = { checkUser }
