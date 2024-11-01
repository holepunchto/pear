const fsp = require('bare-fs/promises')
const readAssetFromUtils = require('./lib/utils.js')

const pipe = Pear.worker.pipe()
pipe.on('data', async (data) => {
  const command = data.toString()
  if (command === 'readAsset') {
    pipe.write(JSON.stringify(await readAsset()))
  }
  else if (command === 'readAssetFromUtils') {
    pipe.write(JSON.stringify(await readAssetFromUtils()))
  }
})

async function readAsset () {
  const text = await fsp.readFile(require.asset('./text-file.txt'))
  return text.toString()
}
