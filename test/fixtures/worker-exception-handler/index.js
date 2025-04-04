const pipe = Pear.worker.pipe()

Bare.on('uncaughtException', (err) => {
	pipe.write(err.message + '\n')
})

throw Error('HANDLED-ERROR')
