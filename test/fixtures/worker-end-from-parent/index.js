const link = Bare.argv[Bare.argv.length - 1]
const pipe = Pear.worker.run(link)
pipe.resume()
await new Promise((resolve) => setTimeout(resolve, 1000))
pipe.end()
