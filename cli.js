'use strict'
const IPC = require('pear-ipc')
const API = require('pear-api')
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
  global.Pear.constructor.RUNTIME = API.RUNTIME
  global.Pear.constructor.RUNTIME_ARGV = API.RUNTIME_ARGV
  global.Pear.constructor.RUNTIME_FLAGS = API.RUNTIME_FLAGS
  global.Pear.constructor.IPC = API.IPC
  global.Pear[global.Pear.constructor.IPC] = ipc
  await cmd(ipc)
}
