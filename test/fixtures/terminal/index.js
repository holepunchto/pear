/* global Pear */
const { teardown } = Pear
import bareInspector from 'bare-inspector'
import { Inspector } from 'pear-inspect'
import Pipe from 'bare-pipe'

const stdout = new Pipe(1)
stdout.unref()

const inspector = new Inspector({ inspector: bareInspector })
const key = await inspector.enable()
const inspectorKey = key.toString('hex')

stdout.write(inspectorKey)

global.__PEAR_TEST__ = { inspector, inspectorKey }

teardown(async() => await inspector.disable())
