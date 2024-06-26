/* global Pear */
import bareInspector from 'bare-inspector'
import { Inspector } from 'pear-inspect'
import Pipe from 'bare-pipe'
import Helper from 'pear/test/helper'
import cmd from 'pear/cmd'
import API from 'pear/lib/api'

const { teardown } = Pear

const stdout = new Pipe(1)
stdout.unref()

const inspector = new Inspector({ inspector: bareInspector })
const key = await inspector.enable()
const inspectorKey = key.toString('hex')

stdout.write(`{ "tag": "inspector", "data": { "key": "${inspectorKey}" }}`)

global.__PEAR_TEST__ = { inspector, inspectorKey, cmd, Helper, API }

teardown(async () => await inspector.disable())
