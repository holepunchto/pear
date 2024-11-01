const program = global.Bare || global.process

Pear.teardown(async () => {
  await new Promise((resolve) => {
    pipe.write('teardown executed', resolve)
  })
  Pear.exit(124)
})

const pipe = Pear.worker.pipe()
pipe.on('data', () => pipe.write(program.pid))
