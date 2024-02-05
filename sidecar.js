'use strict'
const Localdrive = require('localdrive')
const Corestore = require('corestore')
const { SWAP, PLATFORM_CORESTORE } = require('./lib/constants.js')
const subsystem = require('./lib/subsystem.js')

bootSidecar().catch((err) => {
  console.error(err.stack)
  Bare.exit(1)
})

async function bootSidecar () {
  const corestore = new Corestore(PLATFORM_CORESTORE)
  await corestore.ready()

  const drive = await createPlatformDrive(corestore)

  // always start by booting the updater - thats alfa omega
  const updater = await subsystem(drive, '/lib/updater.js')
  await updater(drive)

  const SidecarIPC = await subsystem(drive, '/ipc/sidecar.js')
  const sidecar = new SidecarIPC({ updater: new class Updater { on() {} }, drive, corestore })
  await sidecar.open()
}

function createPlatformDrive () {
  const drive = new Localdrive(SWAP)
  return drive
}
