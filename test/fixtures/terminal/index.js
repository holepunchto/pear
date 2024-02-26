/* global Pear */
const { teardown } = Pear
import nodeInspector from 'bare-inspector'
import { Inspector } from 'pear-inspect'
import Pipe from 'bare-pipe'

const stdout = new Pipe(1)
stdout.unref()

const inspector = new Inspector({ inspector: nodeInspector})
const inspectorKey = await inspector.enable()

stdout.write(`[ inspect ] key: ${inspectorKey.toString('hex')}\n`)
stdout.write('[ inspect ] ready\n')

teardown(async() => inspector.disable())
