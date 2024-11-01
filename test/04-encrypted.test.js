'use strict'
const test = require('brittle')
const path = require('bare-path')
const Helper = require('./helper')
const workerEncrypted = path.join(Helper.localDir, 'test', 'fixtures', 'encrypted')

const rig = new Helper.Rig()

test.hook('encrypted setup', rig.setup)

test('stage, seed and run encrypted app', async function ({ ok, is, plan, comment, timeout, teardown }) {
  timeout(180000)
  plan(3)

  const encryptionKeyName = 'test-encryption-key'
  const helper = new Helper(rig)
  const { key, link } = await helper.__open({ dir: workerEncrypted, comment, teardown, encryptionKeyName })

  const versions = await helper.sendAndWait('versions')
  is(versions.value.app.key, key, 'app version matches staged key')

  comment('pear info encrypted app')
  const infoCmd = helper.info({ link, encryptionKey: encryptionKeyName, cmdArgs: [] })
  const untilInfo = await Helper.pick(infoCmd, [{ tag: 'info' }])
  const info = await untilInfo.info
  ok(info, 'retrieves info from encrypted app')

  const res = await helper.sendAndWait('exit')
  is(res, 'exited', 'worker exited')
})

test.hook('encrypted cleanup', rig.cleanup)
