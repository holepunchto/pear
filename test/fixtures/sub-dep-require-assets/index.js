const readAsset = require('./lib/utils.js')

const pipe = Pear.worker.pipe()
pipe.on('data', () => {
  readAsset().then((text) => {
    pipe.write(text)
  }).catch((err) => {
    console.error(err)
    pipe.write('failed to read asset')
  })
})
