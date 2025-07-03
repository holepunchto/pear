const pipe = Pear.worker.pipe()

pipe.on('data', () => {})

Pear.teardown(async () => {
  await new Promise(resolve => setTimeout(resolve, 999999))
})

Pear.exit()
