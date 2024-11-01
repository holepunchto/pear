const pipe = Pear.worker.pipe()
pipe.on('data', async (data) => {
  const command = data.toString()
  console.log('🚀 ~ command:', command)
  if (command === 'teardown') {
    Pear.teardown(() => {
      console.log('🚀 ~ teardown-executed')
      pipeWrite({ id: 'teardown-executed' })
    })
    pipeWrite({ id: command })
  }
  else if (command === 'exit') {
    Pear.exit()
  }
})

function pipeWrite (value) {
  pipe.write(JSON.stringify(value))
}
