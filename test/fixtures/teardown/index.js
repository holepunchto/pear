Pear.teardown(teardownFn)

const pipe = Pear.worker.pipe()
pipe.on('data', async (data) => {
  const command = data.toString()
  if (command === 'exit') {
    Pear.exit()
  }
})

async function teardownFn () {
  console.log('🚀 ~ teardownFn ~ start')
  await pipeWrite({ id: 'teardown' })
  console.log('🚀 ~ teardownFn ~ end')
}

async function pipeWrite (value) {
  return new Promise((resolve) => {
    pipe.write(JSON.stringify(value), resolve)
  })
}
