const fsp = require('bare-fs/promises')
const readAssetFromUtils = require('./lib/utils.js')

const pipe = Pear.worker.pipe()
pipe.on('data', async (data) => {
  const type = data.toString()
  if (type === 'readAsset') {
    pipeWrite(await readAsset())
  }
  else if (type === 'readAssetFromUtils') {
    pipeWrite(await readAssetFromUtils())
  }
  else if (type === 'exit') {
    Pear.exit()
  }
})

function pipeWrite (value) {
  pipe.write(JSON.stringify(value))
}

async function readAsset () {
  const text = await fsp.readFile(require.asset('./text-file.txt'))
  return text.toString()
}
