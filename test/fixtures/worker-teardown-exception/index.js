const pipe = Pear.worker.pipe()

Pear.teardown(async () => {
  throw new Error()
})

Pear.exit()
