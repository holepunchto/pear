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
  plan(6)

  const dir = encrypted

  const helper = new Helper(rig)
  teardown(() => helper.close(), { order: Infinity })
  await helper.ready()

  const permitHelper = new Helper()
  teardown(() => permitHelper.close(), { order: Infinity })
  await permitHelper.ready()

  const id = Math.floor(Math.random() * 10000)

  const password = hypercoreid.encode(crypto.randomBytes(32))

  comment('staging throws without encryption key')
  const stagingA = helper.stage({ channel: `test-${id}`, name: `test-${id}`, dir, dryRun: false })
  teardown(() => Helper.teardownStream(stagingA))
  const error = await Helper.pick(stagingA, { tag: 'error' })
  is(error.code, 'ERR_PERMISSION_REQUIRED')

  const touch = await helper.touch({ dir, channel: `test-${id}` })
  const { key } = await Helper.pick(touch, { tag: 'result' })
  await helper.permit({ key: hypercoreid.decode(key), password })

  comment('staging with encryption key')
  const stagingB = helper.stage({ channel: `test-${id}`, dir, dryRun: false })
  teardown(() => Helper.teardownStream(stagingB))
  const final = await Helper.pick(stagingB, { tag: 'final' })
  ok(final.success, 'stage succeeded')

  comment('seeding encrypted app')
  const seeding = helper.seed({ channel: `test-${id}`, name: 'encrypted', dir, key: null, cmdArgs: [] })
  teardown(() => Helper.teardownStream(seeding))
  const until = await Helper.pick(seeding, [{ tag: 'key' }, { tag: 'announced' }])
  const announced = await until.announced
  ok(announced, 'seeding is announced')

  await permitHelper.permit({ key: hypercoreid.decode(key), password })
  const link = `pear://${key}`
  const { pipe } = await Helper.run({ link })

  const result = await Helper.untilResult(pipe)
  const versions = JSON.parse(result)
  is(versions.app.key, key, 'app version matches staged key')

  comment('pear info encrypted app')
  const infoCmd = helper.info({ link, cmdArgs: [] })
  const untilInfo = await Helper.pick(infoCmd, [{ tag: 'info' }])
  const info = await untilInfo.info
  ok(info, 'retrieves info from encrypted app')

  await Helper.untilClose(pipe)
  ok(true, 'ended')
})

test.hook('encrypted cleanup', rig.cleanup)
