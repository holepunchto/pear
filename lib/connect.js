const Pipe = require('bare-pipe')
const FramedStream = require('framed-stream')
const Protomux = require('protomux')
const JSONRPC = require('jsonrpc-mux')
const { spawn } = require('bare-subprocess')

const { SOCKET_PATH, RUNTIME, SWAP, PLATFORM_DIR, CONNECT_TIMEOUT } = require('./constants.js')

module.exports = bootpipe

async function bootpipe () {
  let trycount = 0
  let pipe = null
  let timedout = false
  let next = null

  const timeout = setTimeout(() => {
    timedout = true
    if (pipe) pipe.destroy()
  }, CONNECT_TIMEOUT)

  while (true) {
    const promise = new Promise((resolve) => { next = resolve })

    pipe = new Pipe(SOCKET_PATH)
    pipe.on('connect', onconnect)
    pipe.on('error', onerror)

    if (await promise) break
    if (timedout) throw new Error('Could not connect in time')
    if (trycount++ === 0) tryboot()

    await new Promise((resolve) => setTimeout(resolve, trycount < 2 ? 5 : trycount < 10 ? 10 : 100))
  }

  clearTimeout(timeout)

  const framed = new FramedStream(pipe)
  const mux = new Protomux(framed)
  const channel = new JSONRPC(mux)

  channel.on('close', () => framed.end())

  return channel

  function onerror () {
    pipe.removeListener('error', onerror)
    pipe.removeListener('connect', onconnect)
    if (trycount++ === 0) tryboot()
    next(false)
  }

  function onconnect () {
    pipe.removeListener('error', onerror)
    pipe.removeListener('connect', onconnect)
    clearTimeout(timeout)
    next(true)
  }
}

function tryboot () {
  const sc = spawn(RUNTIME, ['--boot-sidecar'], {
    detached: true,
    stdio: Bare.argv.includes('--attach-boot-io') ? 'inherit' : 'ignore',
    cwd: PLATFORM_DIR
  })

  sc.unref()
}
