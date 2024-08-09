import bareInspector from 'bare-inspector'
import { Inspector } from 'pear-inspect'

const inspector = new Inspector({ inspector: bareInspector })
const key = await inspector.enable()
const inspectorKey = key.toString('hex')
console.log(`{ "tag": "inspector", "data": { "key": "${inspectorKey}" }}`)

function disableInspector () {
  inspector.disable()
}

global.disableInspector = disableInspector
