'use strict'
const Corestore = require('corestore')
const hypercoreid = require('hypercore-id-encoding')
const fs = require('bare-fs')
const Rache = require('rache')
const crasher = require('pear-crasher')
const gracedown = require('pear-gracedown')
const os = require('bare-os')
const pear = require('pear-cmd')
const path = require('bare-path')
const {
  SWAP,
  GC,
  PLATFORM_CORESTORE,
  EOLS,
  ALIASES,
  LOCALDEV,
  PLATFORM_DIR,
  WAKEUP
} = require('pear-constants')

const { version, productName, upgrade } = require('./package.json')
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

  const Sidecar = LOCALDEV
    ? require('./subsystems/sidecar/index.js')
    : await subsystem(updater.drive, '/subsystems/sidecar/index.js') // TODO: @keith cleanup subsystem if needed?
  const updater = createUpdater()
  if (updater) await updater.ready()

  const sidecar = new Sidecar({
    updater,
    corestore,
    nodes
  })
  gracedown(() => sidecar.close())
  await sidecar.ipc.ready()

  registerUrlHandler(WAKEUP)

  function createUpdater() {
    if (LOCALDEV || !upgrade) return null
    const app = global.Bare?.argv?.[0]
    if (!app) return null

    const normalizedUpgrade = hypercoreid.normalize(upgrade)
    const forceUpgradeTarget = getForceUpgradeTarget()
    const upgradeTarget = forceUpgradeTarget ? forceUpgradeTarget : normalizedUpgrade
    const versionTarget = forceUpgradeTarget && forceUpgradeTarget !== normalizedUpgrade ? '0.0.0' : version

    const name = path.basename(app) || productName || 'pear'

    return new Sidecar.Updater({
      dir: PLATFORM_DIR,
      store: corestore,
      version: versionTarget,
      upgrade: `pear://${upgradeTarget}`,
      app,
      name
    })
  }
}

function getForceUpgradeTarget() {
  if (LOCALDEV) return null

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

  if (!key) return null

  const cur = hypercoreid.decode(key)
  if (EOLS.pear?.some((key) => cur.equals(key))) {
    key = hypercoreid.encode(ALIASES.pear)
  }

  return `pear://${key}`
}
