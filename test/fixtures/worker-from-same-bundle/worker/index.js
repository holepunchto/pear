const pipe = Pear.worker.pipe()
pipe.on('data', () => {
  try {
    pipe.write(JSON.stringify({ entrypoint: Pear.config.entrypoint }) + '\n')
  } catch (err) {
    console.error(err)
    Pear.exit()
  }
})
