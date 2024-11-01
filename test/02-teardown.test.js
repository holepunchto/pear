'use strict'
const test = require('brittle')
const path = require('bare-path')
const os = require('bare-os')
const hypercoreid = require('hypercore-id-encoding')
const Helper = require('./helper')
const teardownDir = path.join(Helper.localDir, 'test', 'fixtures', 'teardown')
const teardownNestedDir = path.join(Helper.localDir, 'test', 'fixtures', 'teardown-nested')
const teardownExitCodeDir = path.join(Helper.localDir, 'test', 'fixtures', 'teardown-exit-code')

test('teardown', async function ({ ok, is, plan, comment, teardown, timeout }) {
  timeout(180000)
  plan(3)

  const dir = teardownDir

  const helper = new Helper()
  teardown(() => helper.close(), { order: Infinity })
  await helper.ready()

  const id = Math.floor(Math.random() * 10000)

  comment('staging')
  const staging = helper.stage({ channel: `test-${id}`, name: `test-${id}`, dir, dryRun: false, bare: true })
  teardown(() => Helper.teardownStream(staging))
  const staged = await Helper.pick(staging, { tag: 'final' })
  ok(staged.success, 'stage succeeded')

  comment('seeding')
  const seeding = helper.seed({ channel: `test-${id}`, name: `test-${id}`, dir, key: null, cmdArgs: [] })
  teardown(() => Helper.teardownStream(seeding))
  const until = await Helper.pick(seeding, [{ tag: 'key' }, { tag: 'announced' }])
  const announced = await until.announced
  ok(announced, 'seeding is announced')

  const key = await until.key
  ok(hypercoreid.isValid(key), 'app key is valid')

  const link = `pear://${key}`
  const run = await Helper.run({ link })

  const pid = await Helper.untilResult(run.pipe)
  ok(pid.value > 0, 'worker pid is valid')
  os.kill(pid.value)

  const td = await Helper.untilResult(run.pipe)
  is(td, 'teardown executed', 'teardown executed')

  await Helper.untilClose(run.pipe)
  ok(true, 'ended')
})

// TODO: fix me
test.skip('teardown during teardown', async function ({ ok, is, plan, comment, teardown, timeout }) {
  timeout(180000)
  plan(3)

  const dir = teardownNestedDir

  const helper = new Helper()
  teardown(() => helper.close(), { order: Infinity })
  await helper.ready()

  const id = Math.floor(Math.random() * 10000)

  comment('staging')
  const staging = helper.stage({ channel: `test-${id}`, name: `test-${id}`, dir, dryRun: false, bare: true })
  teardown(() => Helper.teardownStream(staging))
  const staged = await Helper.pick(staging, { tag: 'final' })
  ok(staged.success, 'stage succeeded')

  comment('seeding')
  const seeding = helper.seed({ channel: `test-${id}`, name: `test-${id}`, dir, key: null, cmdArgs: [] })
  teardown(() => Helper.teardownStream(seeding))
  const until = await Helper.pick(seeding, [{ tag: 'key' }, { tag: 'announced' }])
  const announced = await until.announced
  ok(announced, 'seeding is announced')

  const key = await until.key
  ok(hypercoreid.isValid(key), 'app key is valid')

  const link = `pear://${key}`
  const run = await Helper.run({ link })

  const pid = await Helper.untilResult(run.pipe)
  ok(pid.value > 0, 'worker pid is valid')
  os.kill(pid.value)

  const td = await Helper.untilResult(run.pipe)
  is(td, 'teardown executed', 'teardown executed')

  await Helper.untilClose(run.pipe)
  ok(true, 'ended')
})

test('exit with non-zero code in teardown', async function ({ ok, is, plan, comment, teardown, timeout }) {
  timeout(180000)
  plan(4)

  const dir = teardownExitCodeDir

  const helper = new Helper()
  teardown(() => helper.close(), { order: Infinity })
  await helper.ready()

  const id = Math.floor(Math.random() * 10000)

  comment('staging')
  const staging = helper.stage({ channel: `test-${id}`, name: `test-${id}`, dir, dryRun: false, bare: true })
  teardown(() => Helper.teardownStream(staging))
  const staged = await Helper.pick(staging, { tag: 'final' })
  ok(staged.success, 'stage succeeded')

  comment('seeding')
  const seeding = helper.seed({ channel: `test-${id}`, name: `test-${id}`, dir, key: null, cmdArgs: [] })
  teardown(() => Helper.teardownStream(seeding))
  const until = await Helper.pick(seeding, [{ tag: 'key' }, { tag: 'announced' }])
  const announced = await until.announced
  ok(announced, 'seeding is announced')

  const key = await until.key
  ok(hypercoreid.isValid(key), 'app key is valid')

  const link = `pear://${key}`
  const run = await Helper.run({ link })

  const pid = await Helper.untilResult(run.pipe)
  ok(pid.value > 0, 'worker pid is valid')
  os.kill(pid.value)

  const td = await Helper.untilResult(run.pipe)
  is(td, 'teardown executed', 'teardown executed')

  const crash = await Helper.untilCrash(run.pipe)
  is(crash.exitCode, 124, 'exit code 124')

  await Helper.untilClose(run.pipe)
  ok(true, 'ended')
})
