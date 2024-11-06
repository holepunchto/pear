const pipe = Pear.worker.pipe()

pipe.once('data', (workerPath) => {
  const workerPipe = Pear.worker.run(workerPath)

  workerPipe.on('data', (data) => {
    pipe.write(data)
    workerPipe.end()
  })

  workerPipe.write('start')
})
