const program = global.Bare || global.process

Pear.teardown(async () => {
  await new Promise((resolve) => {
    pipe.write(JSON.stringify({ id: 'teardown' }), resolve)
  })
  Pear.exit(124)
})

const pipe = Pear.worker.pipe()
pipe.on('data', () => pipe.write(JSON.stringify({ id: 'pid', value: program.pid })))
