const pipe = Pear.worker.pipe()

pipe.once('data', (workerPath) => {
  const workerPipe = Pear.worker.run(workerPath)

  const messages = []
  workerPipe.on('data', (data) => {
    messages.push(data.toString())
    if (messages.length === 4) {
      pipe.write(messages.join(''))
      workerPipe.write('exit')
    }
  })

  workerPipe.write('ping')
})
