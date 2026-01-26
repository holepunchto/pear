#!/usr/bin/env bare
'use strict'
const { platform, arch, isWindows, isBare } = require('which-runtime')
const os = isBare ? require('bare-os') : require('os')
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
const isTTY = isBare ? false : process.stdout.isTTY // TODO: support Bare

const argv = global.Pear?.app.args || global.Bare?.argv || global.process.argv

const parser = command(
  'bootstrap',
  flag('--archdump'),
  flag('--dlruntime'),
  flag('--external-corestore'),
  rest('rest')
)
const cmd = parser.parse(argv.slice(2), { sync: true })

const ARCHDUMP = cmd.flags.archdump === true
const RUNTIMES_DRIVE_KEY =
  cmd.rest?.[0] || 'gd4n8itmfs6x7tzioj6jtxexiu4x4ijiu3grxdjwkbtkczw5dwho'
const RUNTIMES_VERSION = 3272
const CORESTORE =
  cmd.flags.externalCorestore &&
  path.join(os.homedir(), '.pear-archdump', `${RUNTIMES_DRIVE_KEY}`)

const ROOT = global.Pear
  ? path.join(new URL(global.Pear.app.applink).pathname, __dirname)
  : __dirname
const ADDON_HOST = require.addon?.host || platform + '-' + arch
const PEAR = path.join(ROOT, '..', 'pear')
const SWAP = path.join(ROOT, '..')
try {
  fs.symlinkSync(
    '..',
    path.join(PEAR, 'current'),
    !isWindows ? 'junction' : 'file'
  )
} catch (err) {
  if (err.code === 'EPERM') throw err
  safetyCatch(err)
}

const clear = () => {
  if (!isTTY) return
  process.stdout.clearLine()
  process.stdout.cursorTo(0)
}

const runtime = path.join('by-arch', ADDON_HOST, 'bin', 'pear-runtime')
if (isWindows === false) {
  try {
    const peardev = path.join(SWAP, 'pear.dev')
    fs.symlinkSync(runtime, peardev)
    fs.chmodSync(peardev, 0o775)
  } catch (e) {
    /* ignore */
  }
} else {
  const ps1tmp = path.join(SWAP, Math.floor(Math.random() * 1000) + '.pear')
  fs.writeFileSync(ps1tmp, `& "$PSScriptRoot\\${runtime}" @args`)
  fs.renameSync(ps1tmp, path.join(SWAP, 'pear.ps1'))

  const cmdtmp = path.join(SWAP, Math.floor(Math.random() * 1000) + '.pear')
  fs.writeFileSync(cmdtmp, `@echo off\r\n"%~dp0${runtime}" %*`)
  fs.renameSync(cmdtmp, path.join(SWAP, 'pear.cmd'))
}

download(RUNTIMES_DRIVE_KEY, ARCHDUMP).then(advise, console.error)

function advise() {
  if (isWindows === false) {
    console.log(
      '🍐 The ./pear.dev symlink now points to the runtime. Use ./pear.dev as localdev pear.'
    )
    return
  }
  console.log(
    '* The pear.cmd and pear.ps1 scripts wrap the runtime. Use pear.cmd or pear.ps1 as localdev pear.'
  )
}

async function download(key, all = false) {
  if (all) console.log('🍐 Fetching all runtimes from: \n   ' + key)
  else console.log('🍐 [ localdev ] - no local runtime: fetching runtime')

  const store = CORESTORE || path.join(PEAR, 'corestores', 'platform')

  const maxCacheSize = 65536
  const globalCache = new Rache({ maxSize: maxCacheSize })

  const corestore = new Corestore(store, { globalCache })
  let runtimes = new Hyperdrive(corestore, decode(key))

  const swarm = new Hyperswarm()
  goodbye(() => swarm.destroy())

  swarm.on('connection', (socket) => {
    runtimes.corestore.replicate(socket)
  })

  await runtimes.ready()

  swarm.join(runtimes.discoveryKey, { server: false, client: true })
  const done = runtimes.corestore.findingPeers()
  swarm.flush().then(done, done)

  await runtimes.core.update() // make sure we have latest version

  runtimes = runtimes.checkout(RUNTIMES_VERSION)
  goodbye(() => runtimes.close())

  console.log(`\n  Syncing platform runtime${all ? 's' : ''} to disk`)

  const bin = [
    '/by-arch/linux-x64/bin/pear-runtime',
    '/by-arch/linux-arm64/bin/pear-runtime',
    '/by-arch/darwin-x64/bin/pear-runtime',
    '/by-arch/darwin-arm64/bin/pear-runtime',
    '/by-arch/win32-x64/bin/pear-runtime.exe'
  ]
  const lib = [
    '/by-arch/linux-x64/lib',
    '/by-arch/linux-arm64/lib',
    '/by-arch/darwin-x64/lib',
    '/by-arch/darwin-arm64/lib',
    '/by-arch/win32-x64/lib'
  ]
  const wakeup = [
    '/by-arch/linux-x64/bin/pear',
    '/by-arch/linux-arm64/bin/pear',
    '/by-arch/darwin-x64/bin/Pear.app',
    '/by-arch/darwin-arm64/bin/Pear.app',
    '/by-arch/win32-x64/bin/pear.exe'
  ]

  let prefixes = [...bin, ...lib, ...wakeup]
  if (!all)
    prefixes = prefixes.filter((prefix) =>
      prefix.startsWith('/by-arch/' + ADDON_HOST)
    )
  const mirror = runtimes.mirror(new Localdrive(SWAP), { prefix: prefixes })
  const monitor = mirror.monitor()
  monitor.on('update', (stats) => {
    clear()
    const { peers, download } = stats
    process.stdout.write(
      `[ Peers: ${peers} ] [⬇ ${byteSize(download.bytes)} - ${byteSize(download.speed)}/s ]`
    )
  })
  await output(mirror)

  console.log('\x1B[2K\x1B[200D  Runtime sync complete\x1b[K\n')

  await runtimes.close()
  await swarm.destroy()
  await corestore.close()

  const tick = isWindows ? '^' : '✔'

  if (all) console.log('\x1B[32m' + tick + '\x1B[39m Download complete\n')
  else
    console.log(
      '\x1B[32m' +
        tick +
        '\x1B[39m Download complete, initalizing...\n~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~\n\n'
    )
}

async function output(mirror) {
  for await (const { op, key, bytesAdded } of mirror) {
    clear()
    if (op === 'add') {
      console.log(
        '\x1B[32m+\x1B[39m ' + key + ' [' + byteSize(bytesAdded) + ']'
      )
    } else if (op === 'change') {
      console.log(
        '\x1B[33m~\x1B[39m ' + key + ' [' + byteSize(bytesAdded) + ']'
      )
    } else if (op === 'remove') {
      console.log(
        '\x1B[31m-\x1B[39m ' + key + ' [' + byteSize(bytesAdded) + ']'
      )
    }
  }
}
