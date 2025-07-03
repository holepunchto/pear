const pipe = Pear.worker.pipe()

pipe.on('data', () => {})

const interval = setInterval(() => {}, 100)

Pear.teardown(async () => {
  pipe.write('bye\n')
  await new Promise(resolve => setTimeout(resolve, 1000))
})

Pear.exit()
