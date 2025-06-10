const pipe = Pear.pipe
pipe.on('data', () => {
  try {
    pipe.write(JSON.stringify({ entrypoint: Pear.config.entrypoint, fragment: Pear.config.fragment }) + '\n')
  } catch (err) {
    console.error(err)
    Pear.exit()
  }
})
