'use strict'
const test = require('brittle')
const path = require('bare-path')
const os = require('bare-os')
const Helper = require('./helper')
const workerTeardown = path.join(Helper.localDir, 'test', 'fixtures', 'teardown')
const workerTeardownNested = path.join(Helper.localDir, 'test', 'fixtures', 'teardown-nested')
const workerTeardownExitCode = path.join(Helper.localDir, 'test', 'fixtures', 'teardown-exit-code')

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

// TODO: fix me
test.skip('teardown during teardown', async function ({ ok, is, plan, comment, teardown, timeout }) {
  timeout(180000)
  plan(3)

  const helper = new Helper()
  await helper.__open({ dir: workerTeardownNested, comment, teardown })

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

test('exit with non-zero code in teardown', async function ({ ok, is, plan, comment, teardown, timeout }) {
  timeout(180000)
  plan(4)

  const helper = new Helper()
  await helper.__open({ dir: workerTeardownExitCode, comment, teardown })

  helper.register('teardown')
  helper.register('exit')
  helper.register('exitCode')
  
  const pid = await helper.sendAndWait('pid')
  ok(pid.value > 0, 'worker pid is valid')
  os.kill(pid.value)

  const td = await helper.awaitPromise('teardown')
  is(td.value, 'teardown executed', 'teardown executed')

  const ex = await helper.awaitPromise('exit')
  is(ex, 'exited', 'worker exited')

  const exc = await helper.awaitPromise('exitCode')
  is(exc.exitCode, 123, 'exit code 123')
})
