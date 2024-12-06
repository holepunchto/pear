const pipe = Pear.worker.pipe()
pipe.write(`${Bare.pid}`)
await new Promise((resolve) => setTimeout(resolve, 1000))
pipe.destroy()
