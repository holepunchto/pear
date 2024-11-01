const pipe = Pear.worker.pipe()
pipe.on('data', async (data) => {
  const command = data.toString()
  if (command === 'versions') {
    pipe.write(JSON.stringify(await Pear.versions()))
  }
})
