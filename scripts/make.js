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
    'Pear runtime command line interface',
    '--host',
    host,
    '--out',
    `./by-arch/${host}/bin`,
    `targets/main.${channel}.js`
  ],
  { stdio: 'inherit' }
)

child.on('close', (code) => Bare.exit(code))
