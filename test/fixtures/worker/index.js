const pipe = Pear.worker.pipe()

let i = 0

pipe.on('data', (data) => {
  const str = data.toString()
  if (str === 'ping') {
    setInterval(() => pipe.write((i++).toString()), 2000)
  }
  if (str === 'exit') {
    Pear.exit()
  }
})
