const Localdrive = require('localdrive')
const Hyperdrive = require('hyperdrive')
const Corestore = require('corestore')
const fs = require('bare-fs')
const os = require('bare-os')
const path = require('bare-path')
const { print, outputter } = require('./iface')
const subsystem = require('../lib/subsystem')
const { LOCALDEV, SWAP, CHECKOUT, PLATFORM_CORESTORE } = require('../lib/constants')

/* global Bare */
module.exports = (ipc) => async function (args) {
  const key = args[0]

  if (!key) {
    print('No key provided')
    Bare.exit(1)
  }

  print(`Building for ${os.platform()}-${os.arch()}...`)

  // TODO: Cleanup this workaround once pear-dev no longer relies on process
  global.process = require('bare-process')
  global.process.getuid = () => 1000
  global.process.getgid = () => 1000

  const id = Math.random().toString(36).substring(7)
  const buildDir = args[1] ? path.resolve(args[1]) : createTmpDir('build', id)

  print(`Using build directory: ${buildDir}`)

  print('Creating dump...')
  await createDump({ buildDir, key, ipc })

  print('Running init...')
  await init({ key, buildDir })

  print('Running configure...')
  await configure({ buildDir })

  print('Running build...')
  await build({ buildDir })

  print('Build complete!')
  Bare.exit(0)
}

function createTmpDir (type, id) {
  const tmpdir = os.tmpdir()
  const key = 'test'
  const dir = path.join(tmpdir, `pear-${type}-${key}-${id}`)

  fs.mkdirSync(dir)

  return dir
}

async function createDump ({ buildDir, key, ipc }) {
  const output = outputter('stage', {
    dumping: ({ key, dir }) => `  Dumping ${key} into ${dir}`,
    complete: '  Dumping complete!\n',
    error: ({ code, stack }) => `  Dumping Error (code: ${code || 'none'}) ${stack}`
  })

  await output(undefined, ipc.dump({ id: Bare.pid, key, dir: buildDir }))
}

async function createPlatformDrive () {
  if (LOCALDEV) return new Localdrive(SWAP)

  const corestore = new Corestore(PLATFORM_CORESTORE, { manifestVersion: 1, compat: false })

  const drive = new Hyperdrive(corestore.session(), CHECKOUT.key)
  const checkout = drive.checkout(CHECKOUT.length)
  await checkout.ready()
  checkout.on('close', () => drive.close())

  return checkout
}

function checkFile (file) {
  try {
    fs.accessSync(file)
    return true
  } catch {
    return false
  }
}

async function init ({ key, buildDir }) {
  if (!checkFile(path.resolve(buildDir, 'CMakeLists.txt'))) {
    print('  No CMakeLists.txt found, creating one...')

    const drive = await createPlatformDrive()
    const { init } = await subsystem(drive, '/subsystems/build.js')

    // TODO: Read options from somewhere
    await init.appling({
      cwd: buildDir,
      name: 'test',
      key,
      version: '0.0.1',
      author: 'test',
      description: 'test',
      linux: { category: 'Network' },
      macos: {
        identifier: 'test',
        category: 'test',
        entitlements: ['test'],
        signing: { identity: 'test', subject: 'test' }
      },
      windows: { signing: { subject: 'test', thumbprint: 'test' } }
    })
  } else {
    print('  Using existing CMakeLists.txt')
  }
}

async function configure ({ buildDir }) {
  const drive = await createPlatformDrive()
  const { configure } = await subsystem(drive, '/subsystems/build.js')

  const opts = { source: buildDir, cwd: buildDir }

  await configure(opts)
}

async function build ({ buildDir }) {
  const drive = await createPlatformDrive()
  const { build } = await subsystem(drive, '/subsystems/build.js')

  await build({ cwd: buildDir })
}
