import Pipe from 'bare-pipe'
import nodeInspector from 'inspector'
import { Inspector } from 'pear-inspect'

global.Pipe = Pipe
const stdout = global.stdout = new Pipe(1)

const inspector = new Inspector({ inspector: nodeInspector })
const key = await inspector.enable()

global.endInspection = async function () {
  await inspector.disable()
  Bare.exit(0)
}

stdout.write(`${key.toString('hex')}\n`)
