'use strict'
const RPC = require('pear-rpc')
const cmd = require('./cmd')
const crasher = require('./lib/crasher')
const tryboot = require('./lib/tryboot')
const { SWAP, SOCKET_PATH, CONNECT_TIMEOUT } = require('./lib/constants.js')
crasher('cli', SWAP)

cli()

async function cli () {
  const rpc = new RPC({
    socketPath: SOCKET_PATH,
    connectTimeout: CONNECT_TIMEOUT,
    tryboot
  })
  await rpc.ready()
  await cmd(rpc)
}
