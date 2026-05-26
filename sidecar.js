'use strict'
const Localdrive = require('localdrive')
const Corestore = require('corestore')
const Hyperdrive = require('hyperdrive')
const hypercoreid = require('hypercore-id-encoding')
const fs = require('bare-fs')
const Rache = require('rache')
const crasher = require('pear-crasher')
const gracedown = require('pear-gracedown')
const os = require('bare-os')
const {
  SWAP,
  GC,
  PLATFORM_CORESTORE,
  EOLS,
  ALIASES,
  CHECKOUT,
  LOCALDEV,
  UPGRADE_LOCK,
  PLATFORM_DIR,
  WAKEUP
} = require('pear-constants')
const gunk = require('pear-gunk')
const pear = require('pear-cmd')
const registerUrlHandler = require('./url-handler')
const subsystem = require('./subsystem')
crasher('sidecar', SWAP)

os.setProcessTitle('pear-sidecar')
LOG.info('sidecar', '- Sidecar Booting')
module.exports = bootSidecar().catch((err) => {
  LOG.error('internal', 'Sidecar Boot Failed', err)
  Bare.exit(1)
})
async function gc() {
  try {
    await fs.promises.rm(GC, { recursive: true })
  } catch {}
  await fs.promises.mkdir(GC, { recursive: true })
}

async function bootSidecar() {
  await gc()

  const maxCacheSize = 65536
  const globalCache = new Rache({ maxSize: maxCacheSize })
  const nodes = pear(Bare.argv.slice(1))
    .flags.dhtBootstrap?.split(',')
    .map((tuple) => {
      const [host, port] = tuple.split(':')
      const int = +port
      if (Number.isInteger(int) === false) throw new Error(`Invalid port: ${port}`)
      return { host, port: int }
    })

  const corestore = new Corestore(PLATFORM_CORESTORE, {
    globalCache,
    manifestVersion: 1,
    compat: false,
    wait: true
  })
  await corestore.ready()

  const drive = await createPlatformDrive()

  const Sidecar = await subsystem(drive, '/subsystems/sidecar/index.js')
  const updater = createUpdater()

  const sidecar = new Sidecar({
    updater,
    drive,
    corestore,
    nodes,
    gunk
  })
  gracedown(() => sidecar.close())
  await sidecar.ipc.ready()

  registerUrlHandler(WAKEUP)

  function createUpdater() {
    if (LOCALDEV) return null
    const { checkout, swap } = getUpgradeTarget()
    const updateDrive =
      checkout === CHECKOUT || hypercoreid.normalize(checkout.key) === CHECKOUT.key
        ? drive
        : new Hyperdrive(corestore.session(), checkout.key)

    return new Sidecar.Updater(updateDrive, {
      directory: PLATFORM_DIR,
      swap,
      lock: UPGRADE_LOCK,
      checkout
    })
  }

  async function createPlatformDrive() {
    if (LOCALDEV) return new Localdrive(SWAP)

    const drive = new Hyperdrive(corestore.session(), CHECKOUT.key)
    const checkout = drive.checkout(CHECKOUT.length)
    await checkout.ready()
    checkout.on('close', () => drive.close())
    return checkout
  }
}

function getUpgradeTarget() {
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

  const cur = hypercoreid.decode(key ?? CHECKOUT.key)
  if (EOLS.pear?.some((key) => cur.equals(key))) {
    key = hypercoreid.encode(ALIASES.pear)
  }

  if (key === null || key === CHECKOUT.key) return { checkout: CHECKOUT, swap: SWAP }

  return {
    checkout: { key, length: 0, fork: 0 },
    swap: null
  }
}
