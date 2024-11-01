const pipe = Pear.worker.pipe()
pipe.on('data', async (data) => {
  const command = data.toString()
  console.log('🚀 ~ command:', command)
  if (command === 'teardown') {
    Pear.teardown(async () => {
      console.log('🚀 ~ teardown-executed')
      await pipeWrite({ id: 'teardown-executed' })
    })
    await pipeWrite({ id: command })
  }
  else if (command === 'exit') {
    Pear.exit()
  }
})

async function pipeWrite (value) {
  return new Promise((resolve) => {
    pipe.write(JSON.stringify(value), resolve)
  })
}
