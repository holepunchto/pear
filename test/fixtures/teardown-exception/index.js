Pear.teardown(async () => {
  throw new Error('testing uncaught')
})

Pear.exit()
