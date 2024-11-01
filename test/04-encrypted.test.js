'use strict'
const test = require('brittle')
const path = require('bare-path')
const hypercoreid = require('hypercore-id-encoding')
const crypto = require('hypercore-crypto')
const Helper = require('./helper')
const encrypted = path.join(Helper.localDir, 'test', 'fixtures', 'encrypted')

const rig = new Helper.Rig()

test.hook('encrypted setup', rig.setup)

test('stage, seed and run encrypted app', async function ({ ok, is, plan, comment, timeout, teardown }) {
  timeout(180000)
  plan(8)

  const dir = encrypted

  const helper = new Helper(rig)
  teardown(() => helper.close(), { order: Infinity })
  await helper.ready()

  const id = Math.floor(Math.random() * 10000)

  comment('add encryption key')
  const name = 'test-encryption-key'
  const preimage = hypercoreid.encode(crypto.randomBytes(32))
  const addEncryptionKey = helper.encryptionKey({ action: 'add', name, value: preimage })
  teardown(() => Helper.teardownStream(addEncryptionKey))
  const encryptionKey = await Helper.pick(addEncryptionKey, { tag: 'added' })
  is(encryptionKey.name, name)

  comment('staging throws without encryption key')
  const stagingA = helper.stage({ channel: `test-${id}`, name: `test-${id}`, dir, dryRun: false, bare: true })
  teardown(() => Helper.teardownStream(stagingA))
  const error = await Helper.pick(stagingA, { tag: 'error' })
  is(error.code, 'ERR_PERMISSION_REQUIRED')

  comment('staging with encryption key')
  const stagingB = helper.stage({ channel: `test-${id}`, name: `test-${id}`, dir, dryRun: false, encryptionKey: name, bare: true })
  teardown(() => Helper.teardownStream(stagingB))
  const final = await Helper.pick(stagingB, { tag: 'final' })
  ok(final.success, 'stage succeeded')

  comment('seeding encrypted app')
  const seeding = helper.seed({ channel: `test-${id}`, name: `test-${id}`, dir, key: null, encryptionKey: name, cmdArgs: [] })
  teardown(() => Helper.teardownStream(seeding))
  const until = await Helper.pick(seeding, [{ tag: 'key' }, { tag: 'announced' }])
  const announced = await until.announced
  ok(announced, 'seeding is announced')

  const key = await until.key
  ok(hypercoreid.isValid(key), 'app key is valid')

  const link = `pear://${key}`
  const { pipe } = await Helper.run({ link, encryptionKey: name, platformDir: rig.platformDir })

  const result = await Helper.untilResult(pipe)
  const versions = JSON.parse(result)
  is(versions.app.key, key, 'app version matches staged key')

  comment('pear info encrypted app')
  const infoCmd = helper.info({ link, encryptionKey: name, cmdArgs: [] })
  const untilInfo = await Helper.pick(infoCmd, [{ tag: 'info' }])
  const info = await untilInfo.info
  ok(info, 'retrieves info from encrypted app')

  await Helper.end(pipe)
  ok(true, 'ended')
})

test.hook('encrypted cleanup', rig.cleanup)
