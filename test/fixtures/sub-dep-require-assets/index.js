const readAsset = require('./lib/utils.js')

const pipe = Pear.worker.pipe()
pipe.on('data', () => {
  try {
    pipe.write(readAsset())
  } catch (err) {
    console.error(err)
    Pear.exit()
  }
})
