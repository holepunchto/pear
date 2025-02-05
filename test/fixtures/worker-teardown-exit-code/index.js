const pipe = Pear.pipe
pipe.on('data', () => pipe.write(`${Bare.pid}\n`))

Pear.teardown(async () => {
  await new Promise((resolve) => {
    pipe.write('teardown\n', resolve)
  })
  Pear.exit(124)
})
