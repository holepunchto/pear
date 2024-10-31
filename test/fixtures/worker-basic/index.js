const pipe = Pear.worker.pipe()
pipe.on('data', async (data) => {
  const command = data.toString()
  if (command === 'versions') {
    pipeWrite({ id: command, value: await Pear.versions() })
  }
  else if (command === 'dhtBootstrap') {
    pipeWrite({ id: command, value: Pear.config.dht.bootstrap })
  }
  else if (command === 'exit') {
    Pear.exit()
  }
})

function pipeWrite (value) {
  pipe.write(JSON.stringify(value))
}
