const pipe = Pear.worker.pipe()
pipe.on('data', async (data) => {
  const command = data.toString()
  console.log('🚀 ~ command:', command)
  if (command === 'teardown') {
    Pear.teardown(teardownFn)
    await pipeWrite({ id: command })
  }
  else if (command === 'exit') {
    Pear.exit()
  }
})

async function teardownFn () {
  console.log('🚀 ~ teardownFn ~ start')
  await pipeWrite({ id: 'teardown-executed' })
  console.log('🚀 ~ teardownFn ~ end')
}

async function pipeWrite (value) {
  return new Promise((resolve) => {
    pipe.write(JSON.stringify(value), resolve)
  })
}
