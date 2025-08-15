/** @typedef {import('pear-interface')} */ /* global Pear */
import Runtime from 'pear-electron'
import Bridge from 'pear-bridge'

Pear.updates((update) => {
  console.log('Application update available:', update)
})

const bridge = new Bridge()
await bridge.ready()

const runtime = new Runtime()
const pipe = await runtime.start({ bridge })
pipe.on('close', () => Pear.exit())

pipe.on('data', (data) => {
  const cmd = Buffer.from(data).toString()
  if (cmd === 'hello from ui') pipe.write('sweet bidirectionality')
  console.log('PIPE DATA', data + '')
})

pipe.write('hello from app')
