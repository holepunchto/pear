const pipe = require('pear-pipe')()
pipe.on('data', () => {
	pipe.write('hello' + '\n')
})

