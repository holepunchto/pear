const { spawn } = require('bare-subprocess')
const { platform, arch } = require('which-runtime')

const channel = global.Bare.argv[2]
const host = `${platform}-${arch}`

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
    `./out/make`,
    `targets/main.${channel}.js`
  ],
  { stdio: 'inherit', shell: true }
)

child.on('exit', (code, signal) => {
  Bare.exitCode = signal ? 128 + signal : code
})
