const pipe = Pear.worker.pipe()

let i = 0
let interval = null
pipe.on('data', async (data) => {
  const str = data.toString()
  if (str === 'ping') {
    interval = setInterval(() => pipe.write(JSON.stringify({ type: str, value: i++ })), 2000)
  }
  else if (str === 'versions') {
    pipe.write(JSON.stringify({ type: str, value: await Pear.versions() }))
  }
  else if (str === 'dhtBootstrap') {
    pipe.write(JSON.stringify({ type: str, value: Pear.config.dht.bootstrap }))
  }
  else if (str === 'exit') {
    clearInterval(interval)
    pipe.write(JSON.stringify({ type: str }))
    Pear.exit()
  }
})
