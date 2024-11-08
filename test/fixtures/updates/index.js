const pipe = Pear.worker.pipe()

const updates = Pear.updates((data) => {
  pipe.write(JSON.stringify(data))
})

pipe.on('data', (data) => {
  if (data.toString() === 'exit') updates.end()
})

Pear.versions().then((versions) => pipe.write(JSON.stringify(versions)))
