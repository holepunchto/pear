'use strict'
const test = require('brittle')
const path = require('bare-path')
const hypercoreid = require('hypercore-id-encoding')
const crypto = require('hypercore-crypto')
const { Helper } = require('./helper')
const encrypted = path.join(Helper.localDir, 'test', 'fixtures', 'encrypted')

const rig = new Helper.Rig()

test.hook('encrypted setup', rig.setup)

test('stage, seed and run encrypted app', async function ({ ok, is, plan, comment, timeout, teardown }) {
  timeout(180000)
  plan(7)

  const helper = new Helper(rig)
  teardown(() => helper.close(), { order: Infinity })
  await helper.ready()
  const dir = encrypted

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
  const error = await Helper.pick(stagingA, { tag: 'error' })
  is(error.code, 'ERR_PERMISSION_REQUIRED')

  comment('staging with encryption key')
  const stagingB = helper.stage({ channel: `test-${id}`, name: `test-${id}`, dir, dryRun: false, encryptionKey: name, bare: true })
  const final = await Helper.pick(stagingB, { tag: 'final' })
  ok(final.success, 'stage succeeded')

  comment('seeding encrypted app')
  const seeding = helper.seed({ channel: `test-${id}`, name: `test-${id}`, dir, key: null, encryptionKey: name, cmdArgs: [] })
  teardown(() => Helper.teardownStream(seeding))
  const until = await Helper.pick(seeding, [{ tag: 'key' }, { tag: 'announced' }])
  const appKey = await until.key
  const announced = await until.announced
  ok(announced, 'seeding is announced')

  comment('run encrypted pear application')
  const link = 'pear://' + appKey
  const running = await Helper.open(link, { tags: ['exit'] }, { platformDir: rig.platformDir, encryptionKey: name })
  const { value } = await running.inspector.evaluate('Pear.versions()', { awaitPromise: true })

  is(value?.app?.key, appKey, 'app version matches staged key')

  await running.inspector.evaluate('disableInspector()')
  await running.inspector.close()
  const { code } = await running.until.exit
  is(code, 0, 'exit code is 0')

  comment('pear info encrypted app')
  const infoCmd = helper.info({ link, encryptionKey: name, cmdArgs: [] })
  const untilInfo = await Helper.pick(infoCmd, [{ tag: 'info' }])
  const info = await untilInfo.info
  ok(info, 'retrieves info from encrypted app')
})

test.hook('encrypted cleanup', rig.cleanup)
