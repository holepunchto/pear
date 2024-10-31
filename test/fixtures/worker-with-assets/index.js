const fsp = require('bare-fs/promises')
const readAssetFromUtils = require('./lib/utils.js')

const pipe = Pear.worker.pipe()
pipe.on('data', async (data) => {
  const command = data.toString()
  if (command === 'readAsset') {
    pipeWrite({ id: command, value: await readAsset() })
  }
  else if (command === 'readAssetFromUtils') {
    pipeWrite({ id: command, value: await readAssetFromUtils() })
  }
  else if (command === 'exit') {
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
