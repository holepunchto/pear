'use strict'
const test = require('brittle')
const path = require('bare-path')
const os = require('bare-os')
const hypercoreid = require('hypercore-id-encoding')
const Helper = require('./helper')
const workerTeardown = path.join(Helper.localDir, 'test', 'fixtures', 'teardown')

test('teardown', async function ({ ok, is, plan, comment, teardown, timeout }) {
  timeout(180000)
  plan(3)

  const helper = new Helper()
  await helper.__open({ dir: workerTeardown, comment, teardown })

  helper.register('teardown')
  helper.register('exit')
  
  const pid = await helper.sendAndWait('pid')
  ok(pid.value > 0, 'worker pid is valid')
  os.kill(pid.value)

  const td = await helper.awaitPromise('teardown')
  is(td.value, 'teardown executed', 'teardown executed')

  const ex = await helper.awaitPromise('exit')
  is(ex, 'exited', 'worker exited')
})

test.solo('teardown during teardown', async function ({ ok, is, plan, comment, teardown, timeout }) {
  timeout(180000)
  plan(3)

  const helper = new Helper()
  await helper.__open({ dir: workerTeardown, comment, teardown })

  helper.register('teardown')
  helper.register('exit')
  
  const pid = await helper.sendAndWait('pid')
  ok(pid.value > 0, 'worker pid is valid')
  os.kill(pid.value)

  const td = await helper.awaitPromise('teardown')
  is(td.value, 'teardown executed', 'teardown executed')

  const ex = await helper.awaitPromise('exit')
  is(ex, 'exited', 'worker exited')
})

// TODO: fixme
test.skip('exit with non-zero code in teardown', async function ({ is, ok, plan, comment, teardown }) {
  plan(4)

  const stager = new Helper()
  teardown(() => stager.close(), { order: Infinity })
  await stager.ready()

  const dir = harness

  const id = Math.floor(Math.random() * 10000)

  comment('staging')
  const stage = stager.stage({ channel: `test-${id}`, name: `test-${id}`, dir, dryRun: false, bare: true })
  const final = await Helper.pick(stage, { tag: 'final' })
  ok(final.success, 'stage succeeded')

  comment('seeding')
  const seeder = new Helper()
  teardown(() => seeder.close())
  teardown(() => seeder.close(), { order: Infinity })
  await seeder.ready()
  const seed = seeder.seed({ channel: `test-${id}`, name: `test-${id}`, dir })
  teardown(() => Helper.teardownStream(seed))
  const until = await Helper.pick(seed, [{ tag: 'key' }, { tag: 'announced' }])
  const key = await until.key
  const announced = await until.announced

  ok(hypercoreid.isValid(key), 'app key is valid')
  ok(announced, 'seeding is announced')

  comment('running')
  const link = 'pear://' + key
  const running = await Helper.open(link, { tags: ['teardown', 'exit'] })

  await running.inspector.evaluate('Pear.teardown(() => Pear.exit(124))')

  await running.inspector.evaluate('__PEAR_TEST__.close()')
  await running.inspector.close()
  // running.subprocess.kill('SIGINT') <-- this was forcing the exit code, which false-positives the test

  const { code } = await running.until.exit
  is(code, 124, 'exit code is 124')
})
