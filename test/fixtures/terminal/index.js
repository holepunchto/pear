/* global Pear */
import bareInspector from 'bare-inspector'
import { Inspector } from 'pear-inspect'
import Helper from 'pear/test/helper'
import cmd from 'pear/cmd'
import API from 'pear/lib/api'

const { teardown } = Pear

const inspector = new Inspector({ inspector: bareInspector })
const key = await inspector.enable()
const inspectorKey = key.toString('hex')

console.log(`{ "tag": "inspector", "data": { "key": "${inspectorKey}" }}`)

global.__PEAR_TEST__ = { inspector, inspectorKey, cmd, Helper, API, ipc: null, sub: null }

teardown(async () => await inspector.disable())
