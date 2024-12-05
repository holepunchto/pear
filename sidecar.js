'use strict'
const Localdrive = require('localdrive')
const Corestore = require('corestore')
const Hyperdrive = require('hyperdrive')
const hypercoreid = require('hypercore-id-encoding')
const fs = require('bare-fs')
const Rache = require('rache')
const speedometer = require('speedometer')
const subsystem = require('./subsystem.js')
const crasher = require('./lib/crasher')
const teardown = require('./lib/teardown')
const Logger = require('./lib/logger')
const {
  SWAP,
  GC,
  PLATFORM_CORESTORE,
  CHECKOUT,
  LOCALDEV,
  UPGRADE_LOCK,
  PLATFORM_DIR,
  WAKEUP
} = require('./constants')
const registerUrlHandler = require('./url-handler')
const gunk = require('./gunk')
const { flags = {} } = require('./shell')(Bare.argv.slice(1))
crasher('sidecar', SWAP)
global.LOG = new Logger({
  level: flags.logLevel,
  labels: flags.logLabels,
  fields: flags.logFields,
  stacks: flags.logStacks,
  pretty: flags.log
})
LOG.info('sidecar', '- Sidecar Booting')
module.exports = bootSidecar().catch((err) => {
  LOG.error('internal', 'Sidecar Boot Failed', err)
  Bare.exit(1)
})
async function gc () {
  try { await fs.promises.rm(GC, { recursive: true }) } catch {}
  await fs.promises.mkdir(GC, { recursive: true })
}

async function bootSidecar () {
  await gc()

  const maxCacheSize = 65536
  const globalCache = new Rache({ maxSize: maxCacheSize })
  const corestore = new Corestore(PLATFORM_CORESTORE, { globalCache, manifestVersion: 1, compat: false })
  await corestore.ready()

  const drive = await createPlatformDrive()
  const Sidecar = await subsystem(drive, '/subsystems/sidecar/index.js')

  const updater = createUpdater()
  const sidecar = new Sidecar({ updater, drive, corestore, gunk, flags })
  teardown(() => sidecar.close())
  await sidecar.ipc.ready()

  registerUrlHandler(WAKEUP)

  function createUpdater () {
    if (LOCALDEV) return null

    const { checkout, swap } = getUpgradeTarget()
    const isSameKey = checkout === CHECKOUT || hypercoreid.normalize(checkout.key) === CHECKOUT.key
    const updateDrive = isSameKey
      ? drive
      : new Hyperdrive(corestore.session(), checkout.key)

    let onupdate
    if (!isSameKey) {
      const monitor = monitorDrive(updateDrive)
      onupdate = () => monitor()
    }

    return new Sidecar.Updater(updateDrive, { directory: PLATFORM_DIR, swap, lock: UPGRADE_LOCK, checkout, onupdate })
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

/**
 * @param {Hyperdrive} drive
 */
function monitorDrive (drive) {
  if (!isTTY) {
    return {
      clear: () => null,
      stop: () => null
    }
  }

  const downloadSpeedometer = speedometer()
  const uploadSpeedometer = speedometer()
  let peers = 0
  let downloadedBytes = 0
  let uploadedBytes = 0

  drive.getBlobs().then(blobs => {
    blobs.core.on('download', (_index, bytes) => {
      downloadedBytes += bytes
      downloadSpeedometer(bytes)
    })
    blobs.core.on('upload', (_index, bytes) => {
      uploadedBytes += bytes
      uploadSpeedometer(bytes)
    })
    blobs.core.on('peer-add', () => {
      peers = blobs.core.peers.length
    })
    blobs.core.on('peer-remove', () => {
      peers = blobs.core.peers.length
    })
  }).catch(() => {
    // ignore
  })

  const interval = setInterval(() => {
    LOG.info('sidecar', `[⬇ ${byteSize(downloadedBytes)} - ${byteSize(downloadSpeedometer())}/s - ${peers} peers] [⬆ ${byteSize(uploadedBytes)} - ${byteSize(uploadSpeedometer())}/s - ${peers} peers]`)
  }, 10000)

  return () => {
    clearInterval(interval)
  }
}
