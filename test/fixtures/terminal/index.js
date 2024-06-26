/* global Pear */
import bareInspector from 'bare-inspector'
import { Inspector } from 'pear-inspect'
const { teardown } = Pear

const inspector = new Inspector({ inspector: bareInspector })
const key = await inspector.enable()
const inspectorKey = key.toString('hex')

console.log(`{ "tag": "inspector", "data": { "key": "${inspectorKey}" }}`)

global.__PEAR_TEST__ = { inspector, inspectorKey }

teardown(async () => await inspector.disable())
