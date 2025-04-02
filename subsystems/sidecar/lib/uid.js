const { isWindows } = require('which-runtime')
const fs = require('bare-fs')
const { PLATFORM_DIR } = require('pear-api/constants')
const os = require('bare-os')

function checkUser () {
  if (isWindows) return

  const ownerUid = fs.statSync(PLATFORM_DIR).uid
  const userUid = os.userInfo().uid

  if (ownerUid !== userUid) {
    const e = new Error(`The pear platform directory at ${PLATFORM_DIR} is not owned by the user that is running pear. Ensure that you are running as the correct user.`)
    e.name = 'User Permissions Error'
    throw e
  }
}

module.exports = { checkUser }
