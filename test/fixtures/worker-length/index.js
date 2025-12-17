const pipe = Pear.worker.pipe()
const subworker = Pear.worker.run(Pear.app.link + '/worker/index.js')

subworker.on('data', (data) => {
   pipe.write(data + '\n')
  subworker.end()
})
