const pipe = Pear.worker.pipe()

pipe.on('data', async (data) => {
  const command = data.toString()
  if (command === 'teardown') {
    Pear.teardown(() => {
      pipeWrite({ id: 'teardown-executed', value: 'teardown executed' })
    })
    pipeWrite({ id: command, value: 'teardown registered' })
  }
  else if (command === 'exit') {
    Pear.exit()
  }
})

function pipeWrite (value) {
  pipe.write(JSON.stringify(value))
}
