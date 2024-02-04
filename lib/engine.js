const Pipe = require('bare-pipe')
const FramedStream = require('framed-stream')
const Protomux = require('protomux')
const JSONRPC = require('jsonrpc-mux')
const fs = require('bare-fs')

const { IS_WINDOWS, SOCKET_PATH, IDLE_TIMEOUT } = require('./constants.js')

module.exports = async function start (drive) {
  await unlisten()

  let active = 0
  let idle = null

  const server = Pipe.createServer()

  server.on('connection', onconnection)
  server.listen(SOCKET_PATH)

  function onconnection (sock) {
    active++
    clearTimeout(idle)
    idle = null
    sock.on('close', onclose)

    const framed = new FramedStream(sock)
    const mux = new Protomux(framed)
    const channel = new JSONRPC(mux)

    channel.method('info', function () {
      return { alive: true }
    })
  }

  function onclose () {
    active--
    if (active === 0) idle = setTimeout(teardown, IDLE_TIMEOUT)
  }

  function teardown () {
    console.log('goodbye!')
    global.Bare.exit()
  }
}

async function unlisten () {
  try {
    if (!IS_WINDOWS) await fs.promises.unlink(SOCKET_PATH)
  } catch {}
}
