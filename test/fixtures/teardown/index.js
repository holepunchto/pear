Pear.teardown(teardownFn)

const pipe = Pear.worker.pipe()
pipe.on('data', async (data) => {
  const command = data.toString()
  if (command === 'pid') {
    pipeWrite({ id: command, value: Bare.pid })
  }
})

async function teardownFn () {
  await pipeWrite({ id: 'teardown' })
  Pear.exit()
}

async function pipeWrite (value) {
  return new Promise((resolve) => {
    pipe.write(JSON.stringify(value), resolve)
  })
}
