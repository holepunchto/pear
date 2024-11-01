const readAsset = require('./lib/utils.js')

const pipe = Pear.worker.pipe()
pipe.on('data', async (data) => {
  const command = data.toString()
  if (command === 'readAsset') {
    pipe.write(JSON.stringify(await readAsset()))
  }
})
