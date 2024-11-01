const readAsset = require('./lib/utils.js')

const pipe = Pear.worker.pipe()
pipe.on('data', async () => pipe.write(await readAsset()))
