const pipe = Pear.worker.pipe()
pipe.on('data', () => {
  try {
    pipe.write(JSON.stringify(Pear.config.dht.bootstrap))
  } catch (err) {
    console.error(err)
    Pear.exit()
  }
})
