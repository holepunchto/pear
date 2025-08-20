const pipe = Pear.worker.pipe()

Pear.teardown(async () => {
  await new Promise((resolve) => {
    setTimeout(resolve, 999999)
  })
})

Pear.exit()
