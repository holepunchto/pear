'use strict'

const sodium = require('sodium-native')
const { isWindows } = require('which-runtime')
const path = require('bare-path')
const os = require('bare-os')
const b4a = require('b4a')

const IPC_ID = 'pear'
const MAX_UNIX_SOCKET_PATH_BYTES = 103

module.exports = function socketPath(platformDir) {
  const id = pipeId(platformDir)
  if (isWindows) return `\\\\.\\pipe\\${IPC_ID}-${id}`

  const preferred = path.join(platformDir, `${IPC_ID}.sock`)
  if (b4a.byteLength(preferred) <= MAX_UNIX_SOCKET_PATH_BYTES) return preferred

  return path.join('/tmp', `${IPC_ID}-${os.userInfo().uid}-${id}.sock`)
}

function pipeId(value) {
  const buffer = b4a.allocUnsafe(32)
  sodium.crypto_generichash(buffer, b4a.from(value))
  return b4a.toString(buffer, 'hex')
}
