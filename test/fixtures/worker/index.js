const pipe = Pear.worker.pipe()

let i = 0
let interval = null
pipe.on('data', async (data) => {
  const str = data.toString()

  function pipeWrite (value) {
    pipe.write(JSON.stringify({ type: str, value }))
  }

  if (str === 'ping') {
    interval = setInterval(() => pipeWrite(i++), 2000)
  }
  else if (str === 'versions') {
    pipeWrite(await Pear.versions())
  }
  else if (str === 'dhtBootstrap') {
    pipeWrite(Pear.config.dht.bootstrap)
  }
  else if (str === 'exit') {
    clearInterval(interval)
    pipeWrite('exit')
    Pear.exit()
  }
})
