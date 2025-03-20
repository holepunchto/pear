/** @typedef {import('pear-interface')} */ /* global Pear */
import Runtime from 'pear-electron'
import Bridge from 'pear-bridge'

const runtime = new Runtime()

const bridge = new Bridge()
await bridge.ready()

const pipe = await runtime.start({ bridge })
Pear.teardown(() => pipe.end())
