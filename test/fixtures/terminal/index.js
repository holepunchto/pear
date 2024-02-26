/* global Pear */
const { config,versions } = Pear
const { app, platform } = await versions()
import nodeInspector from 'bare-inspector'
import { Inspector } from 'pear-inspect'
import Pipe from 'bare-pipe'


const stdout = new Pipe(1)
stdout.unref()

global.stdout = stdout

const inspector = new Inspector({ inspector: nodeInspector})
const inspectorKey = await inspector.enable()

stdout.write(`[ inspect ] key: ${inspectorKey.toString('hex')}\n`)
stdout.write('[ inspect ] ready\n')

// inspector.disable()
