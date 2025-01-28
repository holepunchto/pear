/** @typedef {import('pear-interface')} */ /* global Pear */
import Runtime from 'pear-electron'
import Bridge from 'pear-bridge'

const runtime = new Runtime()

const bridge = new Bridge()
await bridge.ready()

const pipe = runtime.start({ bridge })
Pear.teardown(() => pipe.end())

// TODO: need resolved user-specified preload on state + need pear-electron renderer ipc -> electron-main ipc get method for that path
