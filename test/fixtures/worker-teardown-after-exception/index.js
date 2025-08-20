const uncaughts = require('uncaughts')

const pipe = Pear.worker.pipe()

Pear.teardown(async () => {
  pipe.write('teardown' + '\n')
})

uncaughts.on(() => {
  Pear.exit()
})

throw new Error('WorkerError')
