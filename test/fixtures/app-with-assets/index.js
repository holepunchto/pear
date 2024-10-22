const bareInspector = require('bare-inspector')
const { Inspector } = require('pear-inspect')
const fsp = require('bare-fs/promises')
const readAssetFromUtils = require('./lib/utils.js')

const inspector = new Inspector({ inspector: bareInspector })

async function readAsset () {
  const text = await fsp.readFile(require.asset('./text-file.txt'))
  return text.toString()
}

async function run () {
  const key = await inspector.enable()
  const inspectorKey = key.toString('hex')
  console.log(`{ "tag": "inspector", "data": { "key": "${inspectorKey}" }}`)
}

run()


function disableInspector () {
  inspector.disable()
}

global.disableInspector = disableInspector
global.readAsset = readAsset
global.readAssetFromUtils = readAssetFromUtils
