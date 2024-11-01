const readAsset = require('./lib/utils.js')

const pipe = Pear.worker.pipe()
pipe.on('data', () => {
  readAsset().then((text) => {
    pipe.write(text)
  }).catch((err) => {
    pipe.write(`${err}`)
  })
})
