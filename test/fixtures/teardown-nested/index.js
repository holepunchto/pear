function foo () {
  bar()
}
function bar () {
  Pear.teardown(async () => {
    await pipeWrite({ id: 'teardown', value: 'teardown executed' })
    Pear.exit()
  })
}
Pear.teardown(foo)

const pipe = Pear.worker.pipe()
pipe.on('data', async (data) => {
  const command = data.toString()
  if (command === 'pid') {
    pipeWrite({ id: command, value: Bare.pid })
  }
})

async function pipeWrite (value) {
  return new Promise((resolve) => {
    pipe.write(JSON.stringify(value), resolve)
  })
}
