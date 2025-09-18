const pipe = require('pear-pipe')()

pipe.on('data', () => {})

Pear.teardown(async () => {
  await new Promise(resolve => setTimeout(resolve, 999999))
})

Pear.exit()
