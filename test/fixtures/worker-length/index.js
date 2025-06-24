const pipe = Pear.worker.pipe()
const subworker = Pear.worker.run(Pear.config.link + '/worker/index.js')

subworker.on('data', (data) => {
   pipe.write(data + '\n')
  subworker.end()
})
