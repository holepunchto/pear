const fsp = require('bare-fs/promises')
const path = require('bare-path')
const env = require('bare-env')
const { spawn } = require('bare-subprocess')
const { platform, arch, isWindows } = require('which-runtime')

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
    if (env.MAC_CODESIGN_IDENTITY) signFlags.push('--identity', env.MAC_CODESIGN_IDENTITY)
    if (env.KEYCHAIN_PROFILE) signFlags.push('--keychain', env.KEYCHAIN_PROFILE)
  }

  const child = spawn(
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
    { stdio: 'inherit', shell: true }
  )

  const exitCode = await new Promise((resolve) => {
    child.on('exit', (code, signal) => {
      resolve(signal ? 128 + signal : code)
    })
  })

  if (exitCode !== 0) throw new Error(`bare-build failed with exit code ${exitCode}`)

  if (env.CI) {
    const src = path.join(out, bin)
    const ext = isWindows ? '.exe' : ''
    const dest = path.join('out', 'make', `pear-${host}${ext}`)

    await fsp.mkdir(path.dirname(dest), { recursive: true })
    await fsp.copyFile(src, dest)
    await fsp.chmod(dest, 0o755)
  }
}

make().catch((err) => {
  console.error(err)
  Bare.exitCode = 1
})
