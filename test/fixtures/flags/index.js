const pipe = require('pear-pipe')()
pipe.on('data', () => {
  pipe.write(JSON.stringify(Pear.app.flags) + '\n')
})
