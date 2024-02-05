'use strict'
const fs = require('fs')
const fsp = require('fs/promises')
const path = require('path')
const Corestore = require('corestore')
const Localdrive = require('localdrive')
const Hyperdrive = require('hyperdrive')
const Hyperswarm = require('hyperswarm')
const goodbye = require('graceful-goodbye')
const byteSize = require('tiny-byte-size')
const { decode } = require('hypercore-id-encoding')

fs.mkdirSync(path.join(__dirname, 'pear'), { recursive: true })
try { fs.symlinkSync(process.platform === 'win32' ? path.resolve('.') : '..', path.join(__dirname, 'pear', 'current'), 'junction') } catch { /* ignore */ }
const HOST = path.join(__dirname, 'by-arch', `${process.platform}-${process.arch}`)
const isWin = process.platform === 'win32'
if (isWin === false) {
  try {
    const peardev = path.join(__dirname, 'pear.dev')
    fs.symlinkSync(path.join( path.join('by-arch', `${process.platform}-${process.arch}`), 'bin', 'pear-runtime'), peardev)
    fs.chmodSync(peardev, 0o775)
  } catch (e) { /* ignore */ }
} else {
  // todo gen PS1 and cmd localdev wrappers for win
}
const ARCHDUMP = process.argv.includes('--archdump')
const DLRUNTIME = process.argv.includes('--dlruntime')
const RUNTIMES_DRIVE_KEY = process.argv.slice(2).find(([ch]) => ch !== '-')
if (!RUNTIMES_DRIVE_KEY) throw new Error('provide key')

const PREBUILDS = path.join(__dirname, 'prebuilds', `${process.platform}-${process.arch}`)

if (ARCHDUMP) {
  const downloading = download(__dirname, RUNTIMES_DRIVE_KEY, true)
  downloading.then(prebuilds).catch(console.error).then(advise)
  downloading.catch(console.error)
} else if (DLRUNTIME || fs.existsSync(HOST) === false) {
  const downloading = download(__dirname, RUNTIMES_DRIVE_KEY)
  downloading.catch(console.error)
  if (DLRUNTIME === false) downloading.then(prebuilds).catch(console.error).then(advise)
} else if (fs.existsSync(PREBUILDS) === false) {
  prebuilds().catch(console.error)
} else {
  console.log('Now run ./pear.dev')
}

async function prebuilds () {
  console.log('🍐 Creating localdev prebuilds folder')
  const nm = path.join(__dirname, 'node_modules')
  await fsp.mkdir(PREBUILDS, { recursive: true })
  const deps = await fsp.readdir(nm)
  for (const dep of deps) {
    const prebuildsPath = path.join(nm, dep, 'prebuilds', `${process.platform}-${process.arch}`)
    try {
      if (fs.statSync(prebuildsPath).isDirectory() === false) continue
    } catch {
      continue // does not exist
    }

    const { name, version } = require(path.join(nm, dep, 'package.json'))

    const prebuildName = name.replace(/\//g, '+') + '@' + version
    const barePrebuild = path.join(prebuildsPath, name + '.bare')
    const nodePrebuild = path.join(prebuildsPath, name + '.node')
    if (fs.existsSync(barePrebuild)) {
      await fsp.copyFile(barePrebuild, path.join(PREBUILDS, prebuildName + '.bare'))
    } else if (fs.existsSync(nodePrebuild)) {
      await fsp.copyFile(nodePrebuild, path.join(PREBUILDS, prebuildName + '.node'))
      if (name === 'udx-native') { // transitionary patch, can remove in future
        await fsp.copyFile(nodePrebuild, path.join(PREBUILDS, 'udx-native@1.7.12.node'))
      }
    }
  }
}

function advise () {
  if (isWin === false) {
    console.log('🍐 The ./pear.dev symlink now points to the runtime. Use ./pear.dev as localdev pear.')
    return
  }
  console.log('🍐 The .\\pear.cmd and .\\pear.ps1 scripts wrap the runtime. Use .\\pear.cmd or .\\pear.ps1 as localdev pear.')
}

async function download (cwd, key, all = false) {
  for await (const output of downloader(cwd, key, all)) process.stdout.write(output)
}

async function * downloader (cwd, key, all) {
  if (all) yield '🍐 Fetching all runtimes from: \n   ' + key
  else yield '🍐 [ localdev ] - no local runtime: fetching runtime'

  const store = path.join(cwd, 'pear', 'corestores', 'platform')
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

  const runtime = runtimes.mirror(new Localdrive(cwd), {
    prefix: '/by-arch',
    filter (key) {
      return all ? key.startsWith('/by-arch') : key.startsWith(`/by-arch/${process.platform}-${process.arch}`)
    }
  })
  for await (const { op, key, bytesAdded } of runtime) {
    if (op === 'add') {
      yield '\x1B[2K\x1B[200D  \x1B[32m+\x1B[39m ' + key + ' [' + byteSize(bytesAdded) + ']'
    } else if (op === 'change') {
      yield '\x1B[2K\x1B[200D  \x1B[33m~\x1B[39m ' + key + ' [' + byteSize(bytesAdded) + ']'
    } else if (op === 'remove') {
      yield '\x1B[2K\x1B[200D  \x1B[31m-\x1B[39m ' + key + ' [' + byteSize(bytesAdded) + ']'
    }
  }

  yield '\x1B[2K\x1B[200D  Runtime extraction complete\x1b[K\n'

  await runtimes.close()
  await swarm.destroy()
  await corestore.close()

  if (all) yield '\x1B[32m✔\x1B[39m Download complete\n'
  else yield '\x1B[32m✔\x1B[39m Download complete, initalizing...\n~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~\n\n'
}
