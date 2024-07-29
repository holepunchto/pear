'use strict'
const Localdrive = require('localdrive')
const Corestore = require('corestore')
const Hyperdrive = require('hyperdrive')
const hypercoreid = require('hypercore-id-encoding')
const fs = require('bare-fs')
const subsystem = require('./subsystem.js')
const crasher = require('./lib/crasher')
const {
  SWAP,
  GC,
  PLATFORM_CORESTORE,
  CHECKOUT,
  LOCALDEV,
  UPGRADE_LOCK,
  PLATFORM_DIR,
  WAKEUP
} = require('./constants.js')
const registerUrlHandler = require('./url-handler.js')
const gunk = require('./gunk')
const verbose = Bare.argv.includes('--verbose')
crasher('sidecar', SWAP)
module.exports = bootSidecar().then(() => {
  if (verbose) console.log('- Sidecar booted')
}).catch((err) => {
  console.error(err.stack)
  Bare.exit(1)
})

async function gc () {
  try { await fs.promises.rm(GC, { recursive: true }) } catch {}
  await fs.promises.mkdir(GC, { recursive: true })
}

async function bootSidecar () {
  await gc()
  const corestore = new Corestore(PLATFORM_CORESTORE, { manifestVersion: 1, compat: false })
  await corestore.ready()

  const drive = await createPlatformDrive()
  const Sidecar = await subsystem(drive, '/subsystems/sidecar/index.js')

  const updater = createUpdater()
  const sidecar = new Sidecar({ updater, drive, corestore, gunk, verbose })
  await sidecar.ipc.ready()

  registerUrlHandler(WAKEUP)

  function createUpdater () {
    if (LOCALDEV) return null

    const { checkout, swap } = getUpgradeTarget()
    const updateDrive = checkout === CHECKOUT || hypercoreid.normalize(checkout.key) === CHECKOUT.key
      ? drive
      : new Hyperdrive(corestore.session(), checkout.key)

    return new Sidecar.Updater(updateDrive, { directory: PLATFORM_DIR, swap, lock: UPGRADE_LOCK, checkout })
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
      key = hypercoreid.normalize(arg.slice(6))
      break
    }

    if (arg === '--key' && Bare.argv.length > i + 1) {
      key = hypercoreid.normalize(Bare.argv[i + 1])
      break
    }
  }

  if (key === null || key === CHECKOUT.key) return { checkout: CHECKOUT, swap: SWAP }

  return {
    checkout: { key, length: 0, fork: 0 },
    swap: null
  }
}
