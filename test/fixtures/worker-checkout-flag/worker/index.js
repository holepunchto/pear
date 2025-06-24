const checkout = Pear.config.flags.checkout

const pipe = Pear.worker.pipe()
pipe.on('data', () => {})
pipe.write(checkout)
