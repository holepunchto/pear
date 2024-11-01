const pipe = Pear.worker.pipe()
pipe.on('data', async (data) => {
  const command = data.toString()
  if (command === 'versions') {
    pipe.write(JSON.stringify(await Pear.versions()))
  }
  else if (command === 'dhtBootstrap') {
    pipe.write(JSON.stringify(Pear.config.dht.bootstrap))
  }
})
