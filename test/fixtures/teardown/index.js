Pear.teardown(async () => {
  await new Promise((resolve) => {
    require('pear-pipe')().write('teardown\n', resolve)
  })
})
