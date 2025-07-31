Pear.pipe.on('data', () => Pear.pipe.write(`${Bare.pid}\n`))
const pipe = Pear.run(Pear.config.applink + '/identify?' + Pear.config.startId)
pipe.on('data', async (data) => { 
  pipe.on('data', (data) => {
    if (data.toString() === 'unloading') {
      Pear.pipe.write(data, () => { Pear.exit()})
    }
  })
  if (data.toString() === 'unwind') Pear[Pear.constructor.IPC].closeClients()
})
