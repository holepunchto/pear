const pipe = Pear.worker.pipe()

pipe.on('data', () => {})

Pear.teardown(async () => {
  setInterval(() => {}, 100)
})
