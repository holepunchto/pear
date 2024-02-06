// this file runs BOTH in an electron context and a bare one
// when electron is gone, it can loose the net, child_process stuff...

const FramedStream = require('framed-stream')
const Protomux = require('protomux')
const JSONRPC = require('jsonrpc-mux')

const { SOCKET_PATH, RUNTIME, PLATFORM_DIR, CONNECT_TIMEOUT, IS_BARE } = require('./constants.js')

const { spawn } = IS_BARE ? require('bare-subprocess') : require('child_process')
const Pipe = IS_BARE ? require('bare-pipe') : require('net')

module.exports = bootpipe

function connect () {
  if (IS_BARE) return new Pipe(SOCKET_PATH)
  const sock = new Pipe.Socket()
  sock.setNoDelay(true)
  sock.connect(SOCKET_PATH)
  return sock
}

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

    pipe = connect()
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
  const sc = spawn(RUNTIME, ['--sidecar'], {
    detached: true,
    stdio: (global.Bare || global.process).argv.includes('--attach-boot-io') ? 'inherit' : 'ignore',
    cwd: PLATFORM_DIR
  })

  sc.unref()
}
