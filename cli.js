'use strict'
const IPC = require('pear-ipc')
const crasher = require('pear-api/crasher')
const tryboot = require('pear-api/tryboot')
const { PLATFORM_LOCK, PLATFORM_DIR, SWAP, SOCKET_PATH, CONNECT_TIMEOUT } = require('pear-api/constants')
const cmd = require('./cmd')
const { isWindows } = require('which-runtime')
const process = require('bare-process')
const fs = require('bare-fs')
crasher('cli', SWAP)

checkRoot()
cli()

function checkRoot () {
  if (isWindows) return

  const ownerIsRoot = fs.statSync(PLATFORM_DIR).uid === 0
  const currentUserIsRoot = process.env.USER === 'root' // replace with process.getuid() if/when it's available

  if (currentUserIsRoot && !ownerIsRoot) {
    throw new Error('Running as root is not allowed when the Pear directory is not owned by root. Please run without root privileges.')
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
