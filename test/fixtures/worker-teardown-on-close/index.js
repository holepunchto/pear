const pipe = Pear.worker.pipe()

pipe.on('data', () => {
  pipe.write(`${Bare.pid}\n`)
})

Pear.teardown(async () => {
  setInterval(() => {}, 100)
})
