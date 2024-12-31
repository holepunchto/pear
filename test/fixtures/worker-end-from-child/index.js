const pipe = Pear.worker.pipe()
pipe.write(`${Bare.pid}\n`)
await new Promise((resolve) => setTimeout(resolve, 1000))
pipe.end()
