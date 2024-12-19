const pipe = Pear.worker.pipe()
pipe.on('data', () => {
  pipe.write(Pear.config.storage)
})
