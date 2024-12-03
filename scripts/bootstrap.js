#!/usr/bin/env bare
'use strict'

const { platform, arch, isWindows, isBare } = require('which-runtime')
const fs = isBare ? require('bare-fs') : require('fs')
const path = isBare ? require('bare-path') : require('path')
const { command, flag, rest } = require('paparam')
const Corestore = require('corestore')
const Localdrive = require('localdrive')
const Hyperdrive = require('hyperdrive')
const Hyperswarm = require('hyperswarm')
const goodbye = global.Pear?.teardown || require('graceful-goodbye')
const byteSize = require('tiny-byte-size')
const { decode } = require('hypercore-id-encoding')
const safetyCatch = require('safety-catch')
const Rache = require('rache')
const speedometer = require('speedometer')
const isTTY = isBare ? false : process.stdout.isTTY // TODO: support Bare

const argv = global.Pear?.config.args || global.Bare?.argv || global.process.argv

const parser = command('bootstrap',
  flag('--archdump'),
  flag('--dlruntime'),
  flag('--external-corestore'),
  rest('rest')
)
const cmd = parser.parse(argv.slice(2), { sync: true })

const ARCHDUMP = cmd.flags.archdump === true
const DLRUNTIME = cmd.flags.dlruntime === true
const RUNTIMES_DRIVE_KEY = cmd.rest?.[0] || 'gd4n8itmfs6x7tzioj6jtxexiu4x4ijiu3grxdjwkbtkczw5dwho'
const CORESTORE = cmd.flags.externalCorestore && `/tmp/pear-archdump/${RUNTIMES_DRIVE_KEY}`

const ROOT = global.Pear ? path.join(new URL(global.Pear.config.applink).pathname, __dirname) : __dirname
const ADDON_HOST = require.addon?.host || platform + '-' + arch
const PEAR = path.join(ROOT, '..', 'pear')
const SWAP = path.join(ROOT, '..')
const HOST = path.join(SWAP, 'by-arch', ADDON_HOST)
try {
  fs.symlinkSync('..', path.join(PEAR, 'current'), !isWindows ? 'junction' : 'file')
} catch (err) {
  if (err.code === 'EPERM') throw err
  safetyCatch(err)
}

const runtime = path.join('by-arch', ADDON_HOST, 'bin', 'pear-runtime')
if (isWindows === false) {
  try {
    const peardev = path.join(SWAP, 'pear.dev')
    fs.symlinkSync(runtime, peardev)
    fs.chmodSync(peardev, 0o775)
  } catch (e) { /* ignore */ }
} else {
  const ps1tmp = path.join(SWAP, Math.floor(Math.random() * 1000) + '.pear')
  fs.writeFileSync(ps1tmp, `& "${runtime}" @args`)
  fs.renameSync(ps1tmp, path.join(SWAP, 'pear.ps1'))
  const cmdtmp = path.join(SWAP, Math.floor(Math.random() * 1000) + '.pear')
  fs.writeFileSync(cmdtmp, `@echo off\r\n"${runtime}" %*`)
  fs.renameSync(cmdtmp, path.join(SWAP, 'pear.cmd'))
}

if (ARCHDUMP) {
  const downloading = download(RUNTIMES_DRIVE_KEY, true)
  downloading.catch(console.error).then(advise)
} else if (DLRUNTIME || fs.existsSync(HOST) === false) {
  const downloading = download(RUNTIMES_DRIVE_KEY, false)
  downloading.catch(console.error)
  if (DLRUNTIME === false) downloading.catch(console.error).then(advise)
} else {
  console.log('Now run ./pear.dev')
}

function advise () {
  if (isWindows === false) {
    console.log('🍐 The ./pear.dev symlink now points to the runtime. Use ./pear.dev as localdev pear.')
    return
  }
  console.log('🍐 The pear.cmd and pear.ps1 scripts wrap the runtime. Use pear.cmd or pear.ps1 as localdev pear.')
}

async function download (key, all = false) {
  if (all) console.log('🍐 Fetching all runtimes from: \n   ' + key)
  else console.log('🍐 [ localdev ] - no local runtime: fetching runtime')

  const store = CORESTORE || path.join(PEAR, 'corestores', 'platform')

  const maxCacheSize = 65536
  const globalCache = new Rache({ maxSize: maxCacheSize })

  const corestore = new Corestore(store, { globalCache })
  let runtimes = new Hyperdrive(corestore, decode(key))

  const swarm = new Hyperswarm()
  goodbye(() => swarm.destroy())

  swarm.on('connection', (socket) => { runtimes.corestore.replicate(socket) })

  await runtimes.ready()

  swarm.join(runtimes.discoveryKey, { server: false, client: true })
  const done = runtimes.corestore.findingPeers()
  swarm.flush().then(done, done)

  await runtimes.core.update() // make sure we have latest version

  runtimes = runtimes.checkout(runtimes.version)
  goodbye(() => runtimes.close())

  console.log(`\n  Extracting platform runtime${all ? 's' : ''} to disk`)

  const runtime = runtimes.mirror(new Localdrive(SWAP), {
    prefix: '/by-arch' + (all ? '' : '/' + ADDON_HOST)
  })

  const monitor = monitorDrive(runtimes)
  goodbye(() => monitor.stop())

  for await (const { op, key, bytesAdded } of runtime) {
    if (isTTY) monitor.clear()
    if (op === 'add') {
      console.log('\x1B[32m+\x1B[39m ' + key + ' [' + byteSize(bytesAdded) + ']')
    } else if (op === 'change') {
      console.log('\x1B[33m~\x1B[39m ' + key + ' [' + byteSize(bytesAdded) + ']')
    } else if (op === 'remove') {
      console.log('\x1B[31m-\x1B[39m ' + key + ' [' + byteSize(bytesAdded) + ']')
    }
  }

  monitor.stop()

  console.log('\x1B[2K\x1B[200D  Runtime extraction complete\x1b[K\n')

  await runtimes.close()
  await swarm.destroy()
  await corestore.close()

  const tick = isWindows ? '^' : '✔'

  if (all) console.log('\x1B[32m' + tick + '\x1B[39m Download complete\n')
  else console.log('\x1B[32m' + tick + '\x1B[39m Download complete, initalizing...\n~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~\n\n')
}

/**
 * @param {Hyperdrive} drive
 */
function monitorDrive (drive) {
  if (!isTTY) return {
    clear: () => null,
    stop: () => null
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

  const clear = () => {
    process.stdout.clearLine()
    process.stdout.cursorTo(0)
  }

  const interval = setInterval(() => {
    clear()
    process.stdout.write(`[⬇ ${byteSize(downloadedBytes)} - ${byteSize(downloadSpeedometer())}/s - ${peers} peers] [⬆ ${byteSize(uploadedBytes)} - ${byteSize(uploadSpeedometer())}/s - ${peers} peers]`)
  }, 500)

  const stop = () => {
    clearInterval(interval)
    clear()
  }

  return {
    clear,
    stop
  }
}
