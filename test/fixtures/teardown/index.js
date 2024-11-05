const program = global.Bare || global.process

const pipe = Pear.worker.pipe()

Pear.teardown(async () => {
  await new Promise((resolve) => {
    pipe.write('teardown', resolve)
  })
})
