const pipe = Pear.worker.pipe()
pipe.on('data', () => {
  try {
    pipe.write('hello world')
  } catch (err) {
    console.error(err)
    Pear.exit()
  }
})
