const pipe = Pear.worker.pipe()

pipe.on('data', async (data) => {
  const command = data.toString()
  if (command === 'versions') {
    pipeWrite(await Pear.versions())
  }
  else if (command === 'dhtBootstrap') {
    pipeWrite(Pear.config.dht.bootstrap)
  }
  else if (command === 'exit') {
    Pear.exit()
  }
})

function pipeWrite (value) {
  pipe.write(JSON.stringify(value))
}
