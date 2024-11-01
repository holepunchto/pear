'use strict'
const test = require('brittle')
const path = require('bare-path')
const Helper = require('./helper')
const workerEncrypted = path.join(Helper.localDir, 'test', 'fixtures', 'encrypted')

const rig = new Helper.Rig()

test.hook('encrypted setup', rig.setup)

test('stage, seed and run encrypted app', async function ({ ok, is, plan, comment, timeout, teardown }) {
  timeout(180000)
  plan(5)

  const encryptionKeyName = 'test-encryption-key'
  const helper = new Helper(rig)
  const { pipe, key, link, encryptionKey, error } = await helper.__open({ dir: workerEncrypted, encryptionKeyName, comment, teardown })
  is(encryptionKey.name, encryptionKeyName)
  is(error.code, 'ERR_PERMISSION_REQUIRED')

  const versions = await Helper.send(pipe, 'versions')
  is(versions.app.key, key, 'app version matches staged key')

  comment('pear info encrypted app')
  const infoCmd = helper.info({ link, encryptionKey: encryptionKeyName, cmdArgs: [] })
  const untilInfo = await Helper.pick(infoCmd, [{ tag: 'info' }])
  const info = await untilInfo.info
  ok(info, 'retrieves info from encrypted app')

  await Helper.end(pipe)
  ok(true, 'ended')
})

test.hook('encrypted cleanup', rig.cleanup)
