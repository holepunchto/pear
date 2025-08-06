/** @typedef {import('pear-interface')} */ /* global Pear */
const updates = Pear.updates((update) => {
  console.log('Application update available:', update)
})
const [grn, rst, dim] = ['\x1b[32m', '\x1b[0m', '\x1b[2m']
const v = ({ key, length, fork }) => `v${fork}.${length}.${(key += '').length <= 12 ? key : key.slice(0, 12) + '…'}`
const { app, platform } = await Pear.versions()
const out = `
${grn}           ▅
           ▀
        ▂▂▄▟▙▃
       ▄▄▄▄▆▆▆▆         ${Pear.config.name}
      ▄▄▄▄▄▆▆▆▆▆        ${dim}${v(app)}${rst}${grn}
      ▄▄▄▄▄▆▆▆▆▆
     ▄▄▄▄▄▄▆▆▆▆▆▆       ${rst}${grn}pear
    ▃▄▄▄▄▄▄▆▆▆▆▆▆▄      ${dim}${v(platform)}${rst}${grn}
   ▄▄▄▄▄▄▄▄▆▆▆▆▆▆▆▆
   ▄▄▄▄▄▄▄▄▆▆▆▆▆▆▆▆     ${rst}${grn}Welcome to the IoP
     ▄▄▄▄▄▄▆▆▆▆▆▆
       ▄▄▄▄▆▆▆▆         
       
       exit: ^C${rst}`
console.log('\n\x1b[s\x1b[J' + out)

Pear.teardown(() => { updates.end() })