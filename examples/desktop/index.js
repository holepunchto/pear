/** @typedef {import('pear-interface')} */ /* global Pear */
import Runtime from 'pear-electron'
import Bridge from 'pear-bridge'

const runtime = new Runtime()
await runtime.ready()

const server = new Bridge()
await server.ready()

const pipe = runtime.start({ info: server.info() })
Pear.teardown(() => pipe.end())
