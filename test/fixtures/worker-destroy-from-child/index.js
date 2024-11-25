const pipe = Pear.worker.pipe()
pipe.resume()
await new Promise((resolve) => setTimeout(resolve, 1000))
pipe.destroy()
