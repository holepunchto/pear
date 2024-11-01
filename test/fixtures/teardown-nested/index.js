const program = global.Bare || global.process

Pear.teardown(foo)

function foo () {
  return bar()
}

async function bar () {
  Pear.teardown(async () => {
    await new Promise((resolve) => {
      pipe.write('teardown executed', resolve)
    })
    Pear.exit()
  })
}

const pipe = Pear.worker.pipe()
pipe.on('data', () => pipe.write(program.pid))
