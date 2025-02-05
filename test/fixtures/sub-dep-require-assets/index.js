const readAsset = require('./lib/utils.js')

const pipe = Pear.pipe
pipe.on('data', () => {
  try {
    pipe.write(readAsset() + '\n')
  } catch (err) {
    console.error(err)
    Pear.exit()
  }
})
