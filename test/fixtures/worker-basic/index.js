const pipe = Pear.worker.pipe()

pipe.on('data', async (data) => {
  const type = data.toString()
  if (type === 'versions') {
    pipeWrite(await Pear.versions())
  }
  else if (type === 'dhtBootstrap') {
    pipeWrite(Pear.config.dht.bootstrap)
  }
  else if (type === 'exit') {
    Pear.exit()
  }
})

function pipeWrite (value) {
  pipe.write(JSON.stringify(value))
}
