const run = require('pear-run')
const parentPipe = require('pear-pipe')()

parentPipe.on('data', () => parentPipe.write(`${Bare.pid}\n`))
const pipe = run(Pear.app.applink + '/identify?' + Pear.app.startId)
pipe.on('data', async (data) => { 
  pipe.on('data', (data) => {
    if (data.toString() === 'unloading') {
      parentPipe.write(data, () => { Pear.exit()})
    }
  })
  if (data.toString() === 'unwind') Pear[Pear.constructor.IPC].closeClients()
})
pipe.on('error', (err) => {
  // ENOTCONN expected:
  if (err.code !== 'ENOTCONN') throw err
})
