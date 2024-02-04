const Localdrive = require('localdrive')
const subsystem  = require('./lib/subsystem.js')
const { ROOT, PRELOAD } = require('./lib/constants')

const fs = require('bare-fs')

const ELECTRON_PRELOAD_BUNDLE = `
const runBundle = require('node-bare-bundle')
const fs = require('fs')
const path = require('path')
const buffer = fs.readFileSync(path.join(__dirname, 'boot.bundle'))
runBundle(buffer, '/preload.cjs')
`

bootSidecar()

async function bootSidecar () {
  const drive = await createPlatformDrive()

  // always start by booting the updater - thats alfa omega
  const updater = await subsystem(drive, '/lib/updater.js')
  await updater(drive)

  if (!(await exists(PRELOAD))) {
    await fs.promises.writeFile(PRELOAD + '.tmp', ELECTRON_PRELOAD_BUNDLE)
    await fs.promises.rename(PRELOAD + '.tmp', PRELOAD)
  }

  // and then boot the rest of the sidecar
  const start = await subsystem(drive, '/lib/engine.js')
  await start(drive)
}

function createPlatformDrive () {
  const drive = new Localdrive(ROOT)
  return drive
}

function exists (filename) {
  try {
    await fs.promises.stat(filename)
    return true
  } catch {
    return false
  }
}
