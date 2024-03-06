'use strict'
const Localdrive = require('localdrive')
const Corestore = require('corestore')
const Hyperdrive = require('hyperdrive')
const HypercoreID = require('hypercore-id-encoding')
const Hypercore = require('hypercore')
const path = require('bare-path')
const subsystem = require('./lib/subsystem.js')
const crasher = require('./lib/crasher')
const { SWAP, PLATFORM_CORESTORE, CHECKOUT, LOCALDEV, UPGRADE_LOCK, PLATFORM_DIR } = require('./lib/constants.js')

crasher('sidecar', SWAP)
module.exports = bootSidecar().catch((err) => {
  console.error(err.stack)
  Bare.exit(1)
})

async function bootSidecar () {
  const corestore = new Corestore(PLATFORM_CORESTORE, { manifestVersion: 1, compat: false })
  await corestore.ready()

  const drive = await createPlatformDrive()
  const { SidecarIPC, Updater } = await subsystem(drive, '/subsystems/sidecar.js')

  const updater = createUpdater()
  const sidecar = new SidecarIPC({ updater, drive, corestore })
  await sidecar.listen()

  function createUpdater () {
    if (LOCALDEV) return null

    const { checkout, swap } = getUpgradeTarget()
    const updateDrive = checkout === CHECKOUT || HypercoreID.normalize(checkout.key) === CHECKOUT.key
      ? drive
      : new Hyperdrive(corestore.session(), checkout.key)

    return new Updater(updateDrive, { directory: PLATFORM_DIR, swap, lock: UPGRADE_LOCK, checkout })
  }

  async function createPlatformDrive () {
    if (LOCALDEV) return new Localdrive(SWAP)

    const drive = new Hyperdrive(corestore.session(), CHECKOUT.key)
    const checkout = drive.checkout(CHECKOUT.length)
    await checkout.ready()
    checkout.on('close', () => drive.close())
    return checkout
  }
}

function getUpgradeTarget () {
  if (LOCALDEV) return { checkout: CHECKOUT, swap: SWAP }

  let key = null

  for (let i = 0; i < Bare.argv.length; i++) {
    const arg = Bare.argv[i]

    if (arg.startsWith('--key=')) {
      key = HypercoreID.normalize(arg.slice(6))
      break
    }

    if (arg === '--key' && Bare.argv.length > i + 1) {
      key = HypercoreID.normalize(Bare.argv[i + 1])
      break
    }
  }

  if (key === null || key === CHECKOUT.key) return { checkout: CHECKOUT, swap: SWAP }

  return {
    checkout: { key: HypercoreID.normalize(key), length: 0, fork: 0 },
    swap: path.join(PLATFORM_DIR, Hypercore.discoveryKey(HypercoreID.decode(key)).toString('hex'), '0')
  }
}
