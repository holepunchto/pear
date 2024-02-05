const Localdrive = require('localdrive')
const Corestore = require('corestore')
const subsystem  = require('./lib/subsystem.js')
const { SWAP, PLATFORM_CORESTORE } = require('./lib/constants.js')

bootSidecar()

async function bootSidecar () {
  const store = new Corestore(PLATFORM_CORESTORE)
  const drive = await createPlatformDrive(store)

  // always start by booting the updater - thats alfa omega
  const updater = await subsystem(drive, '/lib/updater.js')
  await updater(drive)

  // and then boot the rest of the sidecar
  const start = await subsystem(drive, '/lib/engine.js')
  await start(drive, store)
}

function createPlatformDrive () {
  const drive = new Localdrive(SWAP)
  return drive
}

async function exists (filename) {
  try {
    await fs.promises.stat(filename)
    return true
  } catch {
    return false
  }
}
