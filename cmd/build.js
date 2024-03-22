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

function loadJsonFile (file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'))
  } catch (e) {
    throw new Error(`Failed to load ${file}: ${e.message}`)
  }
}

function checkApplingOpts (pkg) {
  if (!pkg.pear) throw new Error('No pear field found in package.json')

  const missingFields = []

  const requiredBaseFields = ['name']
  for (const baseField of requiredBaseFields) {
    if (!pkg[baseField] && !pkg.pear[baseField]) missingFields.push(baseField)
  }

  const requiredFieldsByPlatform = {
    linux: ['build.linux.category'],
    macos: ['build.macos.identifier', 'build.macos.category', 'build.macos.entitlements', 'build.macos.signingIdentity', 'build.macos.signingSubject',],
    windows: ['build.windows.signingSubject', 'build.windows.signingThumbprint']
  }

  missingFields.push(...requiredFieldsByPlatform[os.platform()].filter(field => {
    const fieldPath = field.split('.')

    let value = pkg.pear
    for (const key of fieldPath) {
      if (value[key] === undefined) return true
      value = value[key]
    }

    return false
  }))

  if (missingFields.length > 0) {
    throw new Error(`Missing required pear fields in package.json: ${missingFields.join(', ')}`)
  }
}

function loadApplingOpts (buildDir) {
  const pkgPath = path.resolve(buildDir, 'package.json')
  if (!checkFile(pkgPath)) throw new Error('No package.json found')

  const pkg = loadJsonFile(pkgPath)
  checkApplingOpts(pkg)

  const { pear } = pkg

  return {
    name: pear.name || pkg.name,
    version: pear.version || pkg.version,
    author: pear.author || pkg.author,
    description: pear.description || pkg.description,
    linux: pear?.build?.linux || {},
    macos: {
      identifier: pear?.build?.macos?.identifier,
      category: pear?.build?.macos?.category,
      entitlements: pear?.build?.macos?.entitlements || ['undefined'],
      signing: {
        identity: pear?.build?.macos?.signingIdentity, subject: pear?.build?.macos?.signingSubject
      }
    },
    windows: {
      signing: {
        subject: pear?.build?.windows?.signingSubject, thumbprint: pear?.build?.windows?.signingThumbprint
      }
    }
  }
}

async function init ({ key, buildDir }) {
  if (checkFile(path.resolve(buildDir, 'CMakeLists.txt'))) {
    print('  Using existing CMakeLists.txt')
    return
  }

  print('  No CMakeLists.txt found, creating one...')

  const drive = await createPlatformDrive()
  const { init } = await subsystem(drive, '/subsystems/build.js')

  await init.appling({ cwd: buildDir, key, ...loadApplingOpts(buildDir) })
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
