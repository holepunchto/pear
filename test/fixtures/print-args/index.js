const pipe = Pear.pipe
pipe.on('data', () => {
  try {
    pipe.write(JSON.stringify(Pear.config.args) + '\n')
  } catch (err) {
    console.error(err)
    Pear.exit()
  }
})
