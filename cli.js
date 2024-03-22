'use strict'
const IPC = require('pear-ipc')
const cmd = require('./cmd')
const crasher = require('./lib/crasher')
const tryboot = require('./lib/tryboot')
const { SWAP, SOCKET_PATH, CONNECT_TIMEOUT } = require('./lib/constants.js')
crasher('cli', SWAP)

cli()

async function cli () {
  const ipc = new IPC({
    socketPath: SOCKET_PATH,
    connectTimeout: CONNECT_TIMEOUT,
    connect: tryboot
  })
  await ipc.ready()
  await cmd(ipc)
}
