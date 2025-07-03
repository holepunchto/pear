const pipe = Pear.worker.pipe()

pipe.on('data', () => {})

const interval = setInterval(() => {}, 100)

Pear.teardown(async () => {
  pipe.write('bye\n')
})

Pear.exit()
