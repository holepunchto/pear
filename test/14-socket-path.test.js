'use strict'

const test = require('brittle')
const { isWindows } = require('which-runtime')
const path = require('bare-path')
const b4a = require('b4a')
const socketPath = require('../lib/socket-path')

test('sidecar socket path stays within platform limits', ({ is, ok, not }) => {
  const platformDir = path.join('/tmp', 'pear-test')
  const socket = socketPath(platformDir)

  if (isWindows) {
    ok(socket.startsWith('\\\\.\\pipe\\pear-'))
    return
  }

  is(socket, path.join(platformDir, 'pear.sock'))

  const longPlatformDir = path.join('/tmp', 'x'.repeat(150))
  const shortSocket = socketPath(longPlatformDir)
  not(shortSocket, path.join(longPlatformDir, 'pear.sock'))
  ok(shortSocket.startsWith('/tmp/pear-'))
  ok(b4a.byteLength(shortSocket) <= 103)
  is(shortSocket, socketPath(longPlatformDir))
})
