const Localdrive = require('localdrive')
const subsystem  = require('./lib/subsystem.js')
const { SWAP } = require('./lib/constants')

bootSidecar()

async function bootSidecar () {
  const drive = await createPlatformDrive()

  // always start by booting the updater - thats alfa omega
  const updater = await subsystem(drive, '/lib/updater.js')
  await updater(drive)

  // and then boot the rest of the sidecar
  const start = await subsystem(drive, '/lib/engine.js')
  await start(drive)
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
