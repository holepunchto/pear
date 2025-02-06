const pipe = Pear.pipe
pipe.on('data', () => {
  Pear.versions().then((versions) => {
    pipe.write(JSON.stringify(versions) + '\n')
  }).catch((err) => {
    pipe.write(`${err}\n`)
  })
})
