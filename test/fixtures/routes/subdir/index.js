const pipe = require('pear-pipe')()

pipe.on('data', () => {
  pipe.write('this-is-subdir' + '\n')
})
