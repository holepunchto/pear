'use strict'
const test = require('brittle')
const fs = require('bare-fs')
const path = require('bare-path')
const fsext = require('fs-native-extensions')
const Helper = require('./helper')
const rig = new Helper.Rig()

test.hook('shutdown setup', rig.setup)

test('lock released after shutdown', async function ({ ok, plan, comment, teardown }) {
  plan(1)
  comment('shutting down sidecar')
  const helper = new Helper(rig)
  await helper.ready()
  await helper.shutdown()
  comment('sidecar shutdown')
  comment('checking file lock is free')
  const lock = path.join(rig.platformDir, 'corestores', 'platform', 'primary-key')
  const fd = fs.openSync(lock, 'r+')

  teardown(async () => {
    if (granted) fsext.unlock(fd)
    comment('closing file descriptor')
    fs.closeSync(fd)
    comment('file descriptor closed')
  })

  const granted = fsext.tryLock(fd)
  ok(granted, 'file lock is free')
})

test.hook('shutdown cleanup', rig.cleanup)
