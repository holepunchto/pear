/** @typedef {import('pear-interface')} */ /* global Pear */
import Runtime from 'pear-electron'
import Bridge from 'pear-bridge'

const runtime = new Runtime()
await runtime.ready()

const bridge = new Bridge()
await bridge.ready()

const pipe = runtime.start(bridge.info())
Pear.teardown(() => pipe.end())
