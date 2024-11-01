const pipe = Pear.worker.pipe()
pipe.on('data', () => {
  Pear.versions().then((versions) => {
    pipe.write(JSON.stringify(versions))
  }).catch((err) => {
    console.error(err)
    pipe.end()
  })
})
