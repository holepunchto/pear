const { spawn } = require('bare-subprocess')
const { platform, arch } = require('which-runtime')
const env = require('bare-env')

const channel = env.CHANNEL && env.CHANNEL.length > 0 ? env.CHANNEL : global.Bare.argv[2]
const host = `${platform}-${arch}`

if (!['dev', 'stage', 'production'].includes(channel)) {
  throw new Error(`Channel ${channel} not supported`)
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
