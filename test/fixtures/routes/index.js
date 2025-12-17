const pipe = require('pear-pipe')()

pipe.on('data', () => {
  pipe.write(Pear.app.linkData + '\n')
})
