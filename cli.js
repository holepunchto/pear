'use strict'
const IPC = require('pear-ipc')
const cmd = require('./cmd')
const crasher = require('./lib/crasher')
const tryboot = require('./lib/tryboot')
const { PLATFORM_LOCK, SWAP, SOCKET_PATH, CONNECT_TIMEOUT } = require('./lib/constants.js')
crasher('cli', SWAP)

cli()

async function cli () {
  const ipc = new IPC({
    lock: PLATFORM_LOCK,
    socketPath: SOCKET_PATH,
    connectTimeout: CONNECT_TIMEOUT,
    connect: tryboot
  })
  await ipc.ready()
  await cmd(ipc)
}
