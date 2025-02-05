const pipe = Pear.pipe
pipe.on('data', () => {
  pipe.write(Pear.config.storage + '\n')
})
