'use strict'
const IPC = require('pear-ipc')
const cmd = require('./cmd')
const crasher = require('./lib/crasher')
const tryboot = require('./lib/tryboot')
const { PLATFORM_LOCK, SWAP, SOCKET_PATH, CONNECT_TIMEOUT } = require('./constants.js')
crasher('cli', SWAP)

cli()

async function cli () {
  const ipc = new IPC.Client({
    lock: PLATFORM_LOCK,
    socketPath: SOCKET_PATH,
    connectTimeout: CONNECT_TIMEOUT,
    connect: tryboot
  })
  await cmd(ipc)
}
