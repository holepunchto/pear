const pipe = Pear.pipe

let i = 0
let interval = null
pipe.on('data', (data) => {
  const str = data.toString()
  if (str === 'ping') {
    interval = setInterval(() => pipe.write((i++).toString()), 2000)
  }
  if (str === 'exit') {
    clearInterval(interval)
    Pear.exit()
  }
})
