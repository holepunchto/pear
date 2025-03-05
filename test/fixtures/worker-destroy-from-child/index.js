const pipe = Pear.pipe
pipe.write(`${Bare.pid}\n`)
await new Promise((resolve) => setTimeout(resolve, 1000))
pipe.destroy()
