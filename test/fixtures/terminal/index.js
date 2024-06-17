/* global Pear */
import bareInspector from 'bare-inspector'
import { Inspector } from 'pear-inspect'
import Pipe from 'bare-pipe'
const { teardown } = Pear

const pipe = Pear.worker.pipe() || new Pipe(1)
 pipe.unref()

const inspector = new Inspector({ inspector: bareInspector })
const key = await inspector.enable()
const inspectorKey = key.toString('hex')

pipe.write(`{ "tag": "inspector", "data": { "key": "${inspectorKey}" }}`)

global.__PEAR_TEST__ = { inspector, inspectorKey }

teardown(async () => await inspector.disable())
