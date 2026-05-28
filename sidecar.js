'use strict'
const Corestore = require('corestore')
const fs = require('bare-fs')
const Rache = require('rache')
const crasher = require('./lib/crasher.js')
const gracedown = require('pear-gracedown')
const process = require('bare-process')
const os = require('bare-os')
const pear = require('pear-cmd')
const path = require('bare-path')
const { GC, PLATFORM_CORESTORE, PLATFORM_DIR, LOCALDEV } = require('./constants.js')

const { version, productName, upgrade } = require('./package.json')
const { cmdArgs } = require('./argv')
crasher('sidecar')

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
  const nodes = pear(cmdArgs.filter((arg) => arg !== 'sidecar'))
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

  const Sidecar = require('./subsystems/sidecar/index.js')
  const updater = createUpdater()
  if (updater) await updater.ready()

  const sidecar = new Sidecar({
    updater,
    corestore,
    nodes
  })
  gracedown(() => sidecar.close())
  await sidecar.ipc.ready()

  function createUpdater() {
    if (LOCALDEV || !upgrade) return null
    const app = process.execPath
    if (!app) return null

    const name = path.basename(app) || productName || 'pear'

    return new Sidecar.Updater({
      dir: PLATFORM_DIR,
      store: corestore,
      version,
      upgrade,
      app,
      name
    })
  }
}
