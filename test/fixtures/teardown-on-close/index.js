const pipe = require('pear-pipe')()

pipe.on('data', () => {
  pipe.write(`${Bare.pid}\n`)
})

Pear.teardown(async () => {
  setInterval(() => {}, 100)
})
