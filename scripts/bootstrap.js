#!/usr/bin/env bare
'use strict'
const IS_BARE = !!global.Bare

const fs = IS_BARE ? require('bare-fs') : require('fs')
const path = IS_BARE ? require('bare-path') : require('path')
const Corestore = require('corestore')
const Localdrive = require('localdrive')
const Hyperdrive = require('hyperdrive')
const Hyperswarm = require('hyperswarm')
const goodbye = require('graceful-goodbye')
const byteSize = require('tiny-byte-size')
const { decode } = require('hypercore-id-encoding')

const argv = global.Bare?.argv || global.process.argv

const ADDON_HOST = require.addon?.host || global.process.platform + '-' + global.process.arch
const IS_WINDOWS = (global.Bare?.platform || global.process.platform) === 'win32'
const PEAR = path.join(__dirname, '..', 'pear')
const SWAP = path.join(__dirname, '..')
const HOST = path.join(SWAP, 'by-arch', ADDON_HOST)
const ARCHDUMP = argv.includes('--archdump')
const DLRUNTIME = argv.includes('--dlruntime')
const RUNTIMES_DRIVE_KEY = argv.slice(2).find(([ch]) => ch !== '-')
if (!RUNTIMES_DRIVE_KEY) throw new Error('provide key')

try { fs.symlinkSync(IS_WINDOWS ? PEAR : '..', path.join(PEAR, 'current'), 'junction') } catch { /* ignore */ }

if (IS_WINDOWS === false) {
  try {
    const peardev = path.join(SWAP, 'pear.dev')
    fs.symlinkSync(path.join(path.join('by-arch', ADDON_HOST), 'bin', 'pear-runtime'), peardev)
    fs.chmodSync(peardev, 0o775)
  } catch (e) { /* ignore */ }
} else {
  // todo gen PS1 and cmd localdev wrappers for win
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
  if (IS_WINDOWS === false) {
    console.log('🍐 The ./pear.dev symlink now points to the runtime. Use ./pear.dev as localdev pear.')
    return
  }
  console.log('🍐 The .\\pear.cmd and .\\pear.ps1 scripts wrap the runtime. Use .\\pear.cmd or .\\pear.ps1 as localdev pear.')
}

async function download (key, all = false) {
  for await (const output of downloader(key, all)) console.log(output)
}

async function * downloader (key, all) {
  if (all) yield '🍐 Fetching all runtimes from: \n   ' + key
  else yield '🍐 [ localdev ] - no local runtime: fetching runtime'

  const store = path.join(PEAR, 'corestores', 'platform')
  const corestore = new Corestore(store)
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

  yield `\n  Extracting platform runtime${all ? 's' : ''} to disk\n`

  const runtime = runtimes.mirror(new Localdrive(SWAP), {
    prefix: '/by-arch' + (all ? '' : '/' + ADDON_HOST)
  })

  for await (const { op, key, bytesAdded } of runtime) {
    if (op === 'add') {
      yield '\x1B[32m+\x1B[39m ' + key + ' [' + byteSize(bytesAdded) + ']'
    } else if (op === 'change') {
      yield '\x1B[33m~\x1B[39m ' + key + ' [' + byteSize(bytesAdded) + ']'
    } else if (op === 'remove') {
      yield '\x1B[31m-\x1B[39m ' + key + ' [' + byteSize(bytesAdded) + ']'
    }
  }

  yield '\x1B[2K\x1B[200D  Runtime extraction complete\x1b[K\n'

  await runtimes.close()
  await swarm.destroy()
  await corestore.close()

  if (all) yield '\x1B[32m✔\x1B[39m Download complete\n'
  else yield '\x1B[32m✔\x1B[39m Download complete, initalizing...\n~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~\n\n'
}
