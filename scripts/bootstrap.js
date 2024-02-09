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
console.log('HOST:', HOST)
const ARCHDUMP = argv.includes('--archdump')
const DLRUNTIME = argv.includes('--dlruntime')
const RUNTIMES_DRIVE_KEY = argv.slice(2).find(([ch]) => ch !== '-')
if (!RUNTIMES_DRIVE_KEY) throw new Error('provide key')

try { fs.symlinkSync(IS_WINDOWS ? PEAR : '..', path.join(PEAR, 'current'), 'junction') } catch { console.log('e1:',e)/* ignore */ }

if (IS_WINDOWS === false) {
  try {
    const peardev = path.join(SWAP, 'pear.dev')
    console.log('peardev:', peardev)
    fs.symlinkSync(path.join(path.join('by-arch', ADDON_HOST), 'bin', 'pear-runtime'), peardev)
    fs.chmodSync(peardev, 0o775)
  } catch (e) { console.log('e2:', e)/* ignore */ }
} else {
  console.log('todo gen PS1 and cmd localdev wrappers for win')
  // todo gen PS1 and cmd localdev wrappers for win
}

if (ARCHDUMP) {
  console.log('ARCHDUMP:', ARCHDUMP)
  const downloading = download(RUNTIMES_DRIVE_KEY, true)
  downloading.catch(console.error).then(advise)
} else if (DLRUNTIME || fs.existsSync(HOST) === false) {
  console.log('DLRUNTIME:', DLRUNTIME)
  console.log('fs.existsSync(HOST):', fs.existsSync(HOST))
  const downloading = download(RUNTIMES_DRIVE_KEY, false)
  console.log('dc1')
  downloading.catch(console.error)
  console.log('dc2')
  if (DLRUNTIME === false) {console.log("dlrt false");downloading.catch(console.error).then(advise)}
  console.log('dc3')
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
  console.log('key:', key)

  const store = path.join(PEAR, 'corestores', 'platform') // /Users/runner/work/pear-next/pear-next/pear/corestores/platform
  console.log('store:', store)
  const corestore = new Corestore(store)
  let runtimes = new Hyperdrive(corestore, decode(key))
  // console.log('runtimes:', runtimes)

  const swarm = new Hyperswarm()
  goodbye(() => swarm.destroy())

  swarm.on('connection', (socket) => { console.log('connected to socket:',socket); runtimes.corestore.replicate(socket) })

  await runtimes.ready()

  swarm.join(runtimes.discoveryKey, { server: false, client: true })
  const done = runtimes.corestore.findingPeers()
  swarm.flush().then(done, done)

  await runtimes.core.update() // make sure we have latest version

  runtimes = runtimes.checkout(runtimes.version)
  goodbye(() => runtimes.close())

  yield `\n  Extracting platform runtime${all ? 's' : ''} to disk\n`

  console.log('SWAP:', SWAP) // /Users/runner/work/pear-next/pear-next
  console.log('ADDON_HOST:', ADDON_HOST) // ADDON_HOST: darwin-x64
  const loc = new Localdrive(SWAP)
  console.log('loc.root:', loc.root)
  for await (const name of loc.readdir()) {
    console.log('name:', name)
  }
  const runtime = runtimes.mirror(loc, {
    prefix: '/by-arch' + (all ? '' : '/' + ADDON_HOST) // /by-arch/darwin-x64
  })
  // console.log('runtime:', runtime)

  for await (const { op, key, bytesAdded } of runtime) {
    // console.log('op:',op)
    // console.log('key:',key)
    // console.log('bytesAdded:', bytesAdded)
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
