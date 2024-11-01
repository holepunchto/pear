'use strict'
const test = require('brittle')
const path = require('bare-path')
const Helper = require('./helper')
const workerEncrypted = path.join(Helper.localDir, 'test', 'fixtures', 'worker-encrypted')

const rig = new Helper.Rig()

test.hook('encrypted setup', rig.setup)

test('stage, seed and run encrypted app', async function ({ ok, is, plan, comment, timeout, teardown }) {
  timeout(180000)
  plan(8)

  const encryptionKeyName = 'test-encryption-key'
  const worker = new Helper.Worker()
  const { helper, key, link } = await worker.run({ dir: workerEncrypted, ok, is, comment, teardown, rig, encryptionKeyName })

  const versions = await worker.writeAndWait('versions')
  is(versions.value.app.key, key, 'app version matches staged key')

  comment('pear info encrypted app')
  const infoCmd = helper.info({ link, encryptionKey: encryptionKeyName, cmdArgs: [] })
  const untilInfo = await Helper.pick(infoCmd, [{ tag: 'info' }])
  const info = await untilInfo.info
  ok(info, 'retrieves info from encrypted app')

  const res = await worker.writeAndWait('exit')
  is(res, 'exited', 'worker exited')
})

test.hook('encrypted cleanup', rig.cleanup)
