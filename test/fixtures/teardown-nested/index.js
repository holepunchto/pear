const program = global.Bare || global.process

Pear.teardown(() => a())
const a = () => b()
const b = () => {
  Pear.teardown(async () => {
    await new Promise((resolve) => {
      pipe.write('teardown executed', resolve)
    })
    Pear.exit()
  })
}

const pipe = Pear.worker.pipe()
pipe.on('data', () => pipe.write(program.pid))
