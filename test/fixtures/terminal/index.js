/* global Pear */
import Pipe from 'bare-pipe'
const { config, versions, updates } = Pear
const [grn, rst, dim] = ['\x1b[32m', '\x1b[0m', '\x1b[2m']
const v = ({ key, length, fork }) => `v${fork}.${length}.${(key += '').length <= 12 ? key : key.slice(0, 12) + '…'}`
const { app, platform } = await versions()

const debug = { ready: false, update: false }

const argv = global.Bare?.argv || global.process.argv
const debarg = argv.find(arg => arg.startsWith('--debug='))

if (debarg) {
  const opts = debarg.split('=')[1].split(',')
  debug.ready = opts.includes('ready')
  debug.update = opts.includes('update')
}

const out = `${grn}           ▅
           ▀
        ▂▂▄▟▙▃
       ▄▄▄▄▆▆▆▆         ${config.name}
      ▄▄▄▄▄▆▆▆▆▆        ${dim}${v(app)}${rst}${grn}
      ▄▄▄▄▄▆▆▆▆▆
     ▄▄▄▄▄▄▆▆▆▆▆▆       ${rst}${grn}pear
    ▃▄▄▄▄▄▄▆▆▆▆▆▆▄      ${dim}${v(platform)}${rst}${grn}
   ▄▄▄▄▄▄▄▄▆▆▆▆▆▆▆▆
   ▄▄▄▄▄▄▄▄▆▆▆▆▆▆▆▆     ${rst}${grn}Welcome to the IoP
     ▄▄▄▄▄▄▆▆▆▆▆▆
       ▄▄▄▄▆▆▆▆
`
console.log('\n\x1b[s\x1b[J' + out + '\x1b[0m')
if (debug.ready) {
  setTimeout(() => Bare.exit(1), 20000)

  const stdout = new Pipe(1)
  stdout.write('[DEBUG] READY\n')

  let counter = 0;
  updates(() => {
    stdout.write(`[DEBUG] UPDATE${++counter}\n`)
    if (counter >= 2) Bare.exit(0)
  })
}
