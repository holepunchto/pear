/* global Pear */
const { config, versions } = Pear
const [grn, rst, dim] = ['\x1b[32m', '\x1b[0m', '\x1b[2m']
const v = ({ key, length, fork }) => `v${fork}.${length}.${(key += '').length <= 12 ? key : key.slice(0, 12) + '…'}`
const { app, platform } = await versions()
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
console.log('\n\x1b[s\x1b[J' + out)

const pipe = Pear.worker.pipe()
const isWorker = pipe !== null
if (isWorker) {
  pipe.on('data', (data) => {
    const str = data.toString()
    console.log('parent:', str)
    if (str === 'hello') console.log('world')
    if (str === 'exit') {
      console.log('exiting')
      Pear.exit()
    }
  })
}
