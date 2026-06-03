const fs = require('bare-fs')
const path = require('bare-path')
const env = require('bare-env')
const { spawn } = require('bare-subprocess')
const { platform, arch, isWindows } = require('which-runtime')

const channel = global.Bare.argv[2] || env.CHANNEL || 'production'
const host = `${platform}-${arch}`
const bin = isWindows ? 'pear.exe' : 'pear'
const out = path.join('.', 'by-arch', host, 'bin')

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
    '--host',
    host,
    '--out',
    out,
    `targets/main.${channel}.js`
  ],
  { stdio: 'inherit', shell: true }
)

child.on('exit', (code, signal) => {
  if (signal) return Bare.exit(128 + signal)
  if (code !== 0) return Bare.exit(code)

  const src = path.join(out, bin)
  const ext = isWindows ? '.exe' : ''
  const dest = path.join('out', 'make', `pear-${host}${ext}`)

  fs.mkdirSync(path.dirname(dest), { recursive: true })
  fs.copyFileSync(src, dest)
  fs.chmodSync(dest, 0o755)

  console.log(`wrote ${dest}`)
})
