Pear.teardown(async () => {
  await new Promise((resolve) => {
    Pear.pipe.write('teardown\n', resolve)
  })
})
