const pipe = Pear.pipe
pipe.on('data', () => {
  try {
    pipe.write(JSON.stringify(Pear.config.dht.bootstrap) + '\n')
  } catch (err) {
    console.error(err)
    Pear.exit()
  }
})
