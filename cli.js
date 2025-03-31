'use strict'
const IPC = require('pear-ipc')
const crasher = require('pear-api/crasher')
const tryboot = require('pear-api/tryboot')
const { PLATFORM_LOCK, PLATFORM_DIR, SWAP, SOCKET_PATH, CONNECT_TIMEOUT } = require('pear-api/constants')
const cmd = require('./cmd')
const { isWindows } = require('which-runtime')
const os = require('bare-os')
const fs = require('bare-fs')
crasher('cli', SWAP)

checkUser()
cli()

function checkUser () {
  if (isWindows) return

  const ownerUid = fs.statSync(PLATFORM_DIR).uid
  const userUid = os.userInfo().uid

  if (ownerUid !== userUid) {
    throw new Error('Running is not allowed when the pear platform directory is not owned by the current user. Please ensure that you are running as the correct user.')
  }
}

async function cli () {
  const ipc = new IPC.Client({
    lock: PLATFORM_LOCK,
    socketPath: SOCKET_PATH,
    connectTimeout: CONNECT_TIMEOUT,
    connect: tryboot
  })
  await cmd(ipc)
}
