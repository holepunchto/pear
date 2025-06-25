const pipe = Pear.pipe

pipe.on('data', () => {
  try {
    Pear.info({ dir: '/path/to/dir' })
    pipe.write('pass')
  } catch {
    Pear.exit()
  }
})
