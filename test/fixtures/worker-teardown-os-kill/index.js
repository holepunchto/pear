const pipe = Pear.worker.pipe()
pipe.on('data', () => pipe.write(`${Bare.pid}\n`))

Pear.teardown(async () => {
  await new Promise((resolve) => {
    pipe.write('teardown\n', resolve)
  })
  pipe.end()
})
