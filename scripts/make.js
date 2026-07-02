const fsp = require('bare-fs/promises')
const path = require('bare-path')
const env = require('bare-env')
const os = require('bare-os')
const { spawn } = require('bare-subprocess')
const { platform, arch, isWindows } = require('which-runtime')

const exists = (filepath) =>
  fsp
    .access(filepath)
    .then(() => true)
    .catch(() => false)

function waitForExit(child) {
  return new Promise((resolve, reject) => {
    child.on('exit', (code, signal) => {
      resolve(signal ? 128 + signal : code)
    })
    child.on('error', reject)
  })
}

const gc = []
async function make() {
  const channel = env.CHANNEL ? env.CHANNEL : (global.Bare.argv[2] ?? 'production')

  if (!['dev', 'stage', 'production'].includes(channel)) {
    throw new Error(`Channel ${channel} not supported`)
  }

  const host = `${platform}-${arch}`
  const bin = isWindows ? 'pear.exe' : 'pear'
  const out = path.join('.', 'by-arch', host, 'bin')

  const signFlags = []
  const extraEnv = {}
  const sign = !!(env.MAC_CODESIGN_IDENTITY || env.WINDOWS_CERT_SHA1 || env.KEYCHAIN_PROFILE)
  if (sign) {
    signFlags.push('--sign')
    if (env.WINDOWS_CERT_SHA1) {
      if (isWindows) extraEnv.Path = `${await findSigntoolDir()};${env.Path}`
      signFlags.push('--thumbprint', env.WINDOWS_CERT_SHA1)
    }

    if (env.MAC_CODESIGN_IDENTITY) {
      signFlags.push('--hardened-runtime')
      signFlags.push('--entitlements', path.resolve(__dirname, '..', 'entitlements.plist'))
      signFlags.push('--identity', env.MAC_CODESIGN_IDENTITY)
    }
    if (env.KEYCHAIN_PROFILE) signFlags.push('--keychain', env.KEYCHAIN_PROFILE)
  }

  console.log('Running bare-build for channel', channel, sign ? 'with signing' : 'without signing')
  const build = spawn(
    'bare-build',
    [
      '--standalone',
      '--base',
      '.',
      '--name',
      'pear',
      '--description',
      '"Pear runtime command line interface"',
      ...signFlags,
      '--host',
      host,
      '--out',
      './out/make',
      `targets/main.${channel}.js`
    ],
    { stdio: 'inherit', shell: isWindows, env: { ...env, ...extraEnv } }
  )

  const buildExitCode = await waitForExit(build)
  if (buildExitCode === 0) console.log('bare-build successful')
  else throw new Error(`bare-build failed with exit code ${buildExitCode}`)

  if (sign && env.KEYCHAIN_PROFILE) {
    console.log('Compressing binary into a zip file for notarization...')
    const tmpDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'pear-notarize-'))
    gc.push(tmpDir)
    const zipPath = path.join(tmpDir, 'pear.zip')
    const compress = spawn('ditto', ['-c', '-k', '--sequesterRsrc', path.join(out, bin), zipPath], {
      stdio: 'inherit'
    })

    const compressExitCode = await waitForExit(compress)
    if (compressExitCode === 0) console.log('Compression successful')
    else throw new Error(`Compression failed with exit code ${compressExitCode}`)

    console.log('Notarizing binary...')
    const notarize = spawn(
      'xcrun',
      ['notarytool', 'submit', zipPath, '--keychain-profile', env.KEYCHAIN_PROFILE, '--wait'],
      { stdio: 'inherit' }
    )

    const notarizeExitCode = await waitForExit(notarize)
    if (notarizeExitCode === 0) console.log('Notarization successful')
    else throw new Error(`Notarization failed with exit code ${notarizeExitCode}`)
  }
}

async function findSigntoolDir() {
  const base = 'C:\\Program Files (x86)\\Windows Kits\\10\\bin'
  const arch = os.arch() === 'arm64' ? 'arm64' : 'x64'

  if (!(await exists(base))) throw new Error(`Windows SDK bin directory not found: ${base}`)

  const versions = (await fsp.readdir(base, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory() && /^\d+(\.\d+)*$/.test(entry.name))
    .map((entry) => entry.name)
    .sort(semverSortDesc)

  for (const version of versions) {
    const candidate = path.join(base, version, arch, 'signtool.exe')
    if (await exists(candidate)) return path.dirname(candidate)
  }

  throw new Error('signtool.exe not found in Windows SDK')
}

function semverSortDesc(a, b) {
  const pa = a.split('.').map(Number)
  const pb = b.split('.').map(Number)
  const len = Math.max(pa.length, pb.length)

  for (let i = 0; i < len; i++) {
    const diff = (pb[i] ?? 0) - (pa[i] ?? 0)
    if (diff !== 0) return diff
  }

  return 0
}

make()
  .catch((err) => {
    console.error(err)
    Bare.exitCode = 1
  })
  .finally(async () => {
    for (const dir of gc) {
      try {
        await fsp.rm(dir, { recursive: true, force: true })
      } catch (err) {
        console.error(`Failed to cleanup ${dir}:`, err)
      }
    }
  })
