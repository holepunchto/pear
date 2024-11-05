const program = global.Bare || global.process

const pipe = Pear.worker.pipe()
pipe.on('data', () => pipe.write(JSON.stringify({ id: 'pid', value: program.pid })))

Pear.teardown(async () => {
  await new Promise((resolve) => {
    pipe.write(JSON.stringify({ id: 'teardown' }), resolve)
  })
  Pear.exit(124)
})
