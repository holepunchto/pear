'use strict'
const Corestore = require('corestore')
const fs = require('bare-fs')
const Rache = require('rache')
const crasher = require('pear-crasher')
const gracedown = require('pear-gracedown')
const process = require('bare-process')
const os = require('bare-os')
const pear = require('pear-cmd')
const path = require('bare-path')
const { SWAP, GC, PLATFORM_CORESTORE, PLATFORM_DIR } = require('pear-constants')

const { version, productName, upgrade } = require('./package.json')
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
    .map(parseBootstrapAddr)
    .filter(Boolean)

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
    // if (!global.__STANDALONE || !upgrade) return null
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

function parseBootstrapAddr(tuple) {
  if (!tuple) return null

  // [ipv6]:port
  if (tuple[0] === '[') {
    const end = tuple.indexOf(']')
    if (end === -1) throw new Error(`Invalid bootstrap node: ${tuple}`)
    const host = tuple.slice(1, end)
    const sep = tuple.indexOf(':', end)
    if (sep === -1) throw new Error(`Invalid bootstrap node: ${tuple}`)
    const port = Number(tuple.slice(sep + 1))
    if (!Number.isInteger(port)) throw new Error(`Invalid port: ${tuple.slice(sep + 1)}`)
    return { host, port }
  }

  // hostname/ipv4:port (split on last colon)
  const idx = tuple.lastIndexOf(':')
  if (idx === -1) throw new Error(`Invalid bootstrap node: ${tuple}`)
  const host = tuple.slice(0, idx)
  const portRaw = tuple.slice(idx + 1)
  const port = Number(portRaw)
  if (!host || !Number.isInteger(port)) throw new Error(`Invalid port: ${portRaw}`)
  return { host, port }
}
