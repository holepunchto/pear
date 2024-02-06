/* global Pear */
const { config, messages, versions, stdio } = Pear
const [grn, rst, dim] = ['\x1b[32m', '\x1b[0m', '\x1b[2m']
const v = ({ key, length, fork }) => `v${fork}.${length}.${(key += '').length <= 12 ? key : key.slice(0, 12) + '…'}`
const { app, platform } = await versions()

const debug = process.argv.includes('--debug');

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
stdio.out.write('\n\x1b[s\x1b[J' + out + '\x1b[0m');
if(debug) stdio.out.write('[DEBUG] READY')

async function receiveUpdates() {
  for await (const msg of messages({ type: 'pear/updates' })) {
    if(debug) stdio.out.write('[DEBUG] UPDATE', msg.toString())
  }
}

receiveUpdates().catch(console.error)

