const pipe = Pear.worker.pipe()

const [workerPath] = Pear.config.args
const workerPipe = Pear.worker.run(workerPath)
workerPipe.on('data', (data) => {
  pipe.write(data)
  workerPipe.end()
})

workerPipe.write('start')
