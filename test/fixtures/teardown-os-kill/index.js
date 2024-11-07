const pipe = Pear.worker.pipe()
pipe.on('data', () => pipe.write(`${Bare.pid}`))

Pear.teardown(async () => {
  await new Promise((resolve) => {
    pipe.write('teardown', resolve)
  })
})
