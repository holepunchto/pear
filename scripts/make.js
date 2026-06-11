const fsp = require('bare-fs/promises')
const path = require('bare-path')
const env = require('bare-env')
const os = require('bare-os')
const { spawn } = require('bare-subprocess')
const { platform, arch, isWindows } = require('which-runtime')

function waitForExit(child) {
  return new Promise((resolve) => {
    child.on('exit', (code, signal) => {
      resolve(signal ? 128 + signal : code)
    })
  })
}

const gc = []
async function make() {
  const channel = global.Bare.argv[2] || env.CHANNEL || 'production'
  const host = `${platform}-${arch}`
  const bin = isWindows ? 'pear.exe' : 'pear'
  const out = path.join('.', 'by-arch', host, 'bin')

  const signFlags = []
  const sign = !!(env.MAC_CODESIGN_IDENTITY || env.WINDOWS_CERT_SHA1 || env.KEYCHAIN_PROFILE)
  if (sign) {
    signFlags.push('--sign')
    if (env.WINDOWS_CERT_SHA1) signFlags.push('--thumbprint', env.WINDOWS_CERT_SHA1)
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
      out,
      `targets/main.${channel}.js`
    ],
    { stdio: 'inherit', shell: isWindows }
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

  if (env.CI) {
    console.log('Copying binary to out/make for CI release...')
    const src = path.join(out, bin)
    const ext = isWindows ? '.exe' : ''
    const dest = path.join('out', 'make', `pear-${host}${ext}`)

    await fsp.mkdir(path.dirname(dest), { recursive: true })
    await fsp.copyFile(src, dest)
    await fsp.chmod(dest, 0o755)

    console.log(`Binary copied to ${dest}`)
  }
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
