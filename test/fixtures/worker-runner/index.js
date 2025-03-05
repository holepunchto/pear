const pipe = Pear.pipe

const [workerPath] = Pear.config.args
const workerPipe = Pear.run(workerPath)
workerPipe.on('data', (data) => {
  pipe.write(data)
  workerPipe.end()
})

workerPipe.write('start')
