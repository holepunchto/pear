const program = global.Bare || global.process

const pipe = Pear.worker.pipe()
pipe.on('data', () => pipe.write(`${program.pid}`))

Pear.teardown(async () => {
  await new Promise((resolve) => {
    pipe.write('teardown', resolve)
  })
  Pear.exit(124)
})
