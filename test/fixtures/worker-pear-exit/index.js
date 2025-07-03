const pipe = Pear.worker.pipe()

pipe.on('data', () => {})

const interval = setInterval(() => {}, 100)

Pear.teardown(async () => {
  clearInterval(interval)
})

Pear.exit()
