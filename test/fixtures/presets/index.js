const pipe = Pear.worker.pipe()
pipe.on('data', () => {
  pipe.write(JSON.stringify(Pear.config.flags) + '\n')
})
