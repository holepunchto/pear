'use strict'
const Localdrive = require('localdrive')
const Corestore = require('corestore')
const Hyperdrive = require('hyperdrive')
const subsystem = require('./lib/subsystem.js')
const { SWAP, PLATFORM_CORESTORE, CHECKOUT, LOCALDEV } = require('./lib/constants.js')

module.exports = bootSidecar().catch((err) => {
  console.error(err.stack)
  Bare.exit(1)
})

async function bootSidecar () {
  const corestore = new Corestore(PLATFORM_CORESTORE)
  await corestore.ready()

  const drive = await createPlatformDrive(corestore)

  // always start by booting the updater - thats alfa omega
  const checkout = getUpgradeTarget()
  const updater = await subsystem(drive, '/lib/updater.js')
  if (!LOCALDEV) await updater(drive, checkout)

  const SidecarIPC = await subsystem(drive, '/ipc/sidecar.js')
  const sidecar = new SidecarIPC({ updater: new class Updater { on () {} }(), drive, corestore })
  await sidecar.listen()
}

async function createPlatformDrive (corestore) {
  if (LOCALDEV) return new Localdrive(SWAP)
  const drive = new Hyperdrive(corestore.session(), CHECKOUT.key)
  const checkout = drive.checkout(CHECKOUT.length)
  await checkout.ready()
  checkout.on('close', () => drive.close())
  return checkout
}

function getUpgradeTarget () {
  if (LOCALDEV) return CHECKOUT
  for (let i = 0; i < Bare.argv.length; i++) {
    const arg = Bare.argv[i]
    if (arg.startsWith('--key=')) return { key: arg.slice(6), length: 0, fork: 0 }
    if (arg === '--key' && Bare.argv.length > i + 1) return { key: arg[i + 1], length: 0, fork: 0 }
  }
  return CHECKOUT
}
