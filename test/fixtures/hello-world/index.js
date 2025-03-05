const pipe = Pear.pipe
pipe.on('data', () => {
  try {
    pipe.write('hello world\n')
  } catch (err) {
    console.error(err)
    Pear.exit()
  }
})
