const link = Bare.argv[Bare.argv.length - 1]
const pipe = Pear.worker.pipe()
pipe.on('data', () => {})
const length = link.substr(7).split('.')[1]
pipe.write(length)
