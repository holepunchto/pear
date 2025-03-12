'use strict'
const IPC = require('pear-ipc')
const cmd = require('./cmd')
const crasher = require('./lib/crasher')
const tryboot = require('./lib/tryboot')
const { SWAP, SOCKET_PATH, CONNECT_TIMEOUT, UPGRADE_LOCK } = require('./constants.js')
crasher('cli', SWAP, Bare.argv.indexOf('--log') > -1)

cli()

async function cli () {
  const ipc = new IPC.Client({
    lock: UPGRADE_LOCK,
    socketPath: SOCKET_PATH,
    connectTimeout: CONNECT_TIMEOUT,
    connect: tryboot
  })
  await cmd(ipc)
}
