'use strict'
const IPC = require('pear-ipc')
const crasher = require('pear-crasher')
const tryboot = require('pear-tryboot')
const { SWAP, SOCKET_PATH, CONNECT_TIMEOUT } = require('pear-constants')
const cmd = require('./cmd')
crasher('cli', SWAP)

cli()

async function cli() {
  const ipc = new IPC.Client({
    socketPath: SOCKET_PATH,
    connectTimeout: CONNECT_TIMEOUT,
    connect: tryboot
  })
  await cmd(ipc)
}
