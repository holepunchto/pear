const Pipe = require('bare-pipe')
const FramedStream = require('framed-stream')
const Protomux = require('protomux')
const JSONRPC = require('jsonrpc-mux')
const fs = require('bare-fs')
const Hyperdrive = require('hyperdrive')
const Hyperswarm = require('hyperswarm')
const Bundle = require('./bundle.js')

const { IS_WINDOWS, SOCKET_PATH, IDLE_TIMEOUT } = require('./constants.js')

module.exports = async function start (drive, store) {
  await unlisten()

  const swarm = new Hyperswarm()

  swarm.on('connection', function (connection) {
    store.replicate(connection)
  })

  let active = 0
  let idle = setTimeout(teardown, IDLE_TIMEOUT)

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

    channel.method('run', async function ([key]) {
      const b = Bundle.fromKey(store, key, swarm)
      channel.on('close', () => b.close())
      await b.replicate()
      return await b.bundle()
    })

    channel.method('info', function () {
      return { alive: true }
    })
  }

  function onclose () {
    active--
    if (active === 0) idle = setTimeout(teardown, IDLE_TIMEOUT)
  }

  async function teardown () {
    console.log('idle! tearing down...')
    setTimeout(() => global.Bare.exit(), 10_000) // deathclock...
    server.close()
    await swarm.destroy()
    console.log('goodbye!')
    global.Bare.exit()
  }
}

async function unlisten () {
  try {
    if (!IS_WINDOWS) await fs.promises.unlink(SOCKET_PATH)
  } catch {}
}
