'use strict'
const { isWindows } = require('which-runtime')
const test = require('brittle')
const path = require('bare-path')
const os = require('bare-os')
const hypercoreid = require('hypercore-id-encoding')
const Helper = require('./helper')
const teardownDir = path.join(Helper.localDir, 'test', 'fixtures', 'teardown')
const teardownOsKillDir = path.join(Helper.localDir, 'test', 'fixtures', 'teardown-os-kill')
const teardownExitCodeDir = path.join(Helper.localDir, 'test', 'fixtures', 'teardown-exit-code')

test('teardown on pipe end', async function ({ ok, is, plan, comment, teardown, timeout }) {
  if (isWindows) return
  
  timeout(180000)
  plan(4)

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
  const { pipe } = run

  const teardownPromise = Helper.untilResult(run.pipe)

  pipe.end()

  const td = await teardownPromise
  is(td, 'teardown', 'teardown executed')
})

test('teardown on os kill', async function ({ ok, is, plan, comment, teardown, timeout }) {
  if (isWindows) return
  
  timeout(180000)
  plan(5)

  const dir = teardownOsKillDir

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
  const { pipe } = run

  const pidPromise = Helper.untilResult(pipe)

  pipe.write('start')

  const pid = +(await pidPromise)
  ok(pid > 0, 'worker pid is valid')

  const teardownPromise = new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => reject(new Error('timed out')), 5000)
    pipe.once('data', (data) => {
      clearTimeout(timeoutId)
      resolve(data.toString())
    })
    pipe.on('close', () => {
      clearTimeout(timeoutId)
      reject(new Error('unexpected closed'))
    })
    pipe.on('end', () => {
      clearTimeout(timeoutId)
      reject(new Error('unexpected ended'))
    })
  })

  os.kill(pid)

  const td = await teardownPromise
  ok(td, 'teardown executed')
})

test('teardown on os kill with exit code', async function ({ ok, is, plan, comment, teardown, timeout }) {
  if (isWindows) return

  timeout(180000)
  plan(6)

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
  const { pipe } = run

  const pidPromise = Helper.untilResult(pipe)

  pipe.write('start')

  const pid = +(await pidPromise)
  ok(pid > 0, 'worker pid is valid')

  const teardownPromise = new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => reject(new Error('timed out')), 5000)
    pipe.on('data', (data) => {
      clearTimeout(timeoutId)
      resolve(data.toString())
    })
    pipe.on('close', () => {
      clearTimeout(timeoutId)
      reject(new Error('unexpected closed'))
    })
    pipe.on('end', () => {
      clearTimeout(timeoutId)
      reject(new Error('unexpected ended'))
    })
  })

  const exitCodePromise = new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => reject(new Error('timed out')), 5000)
    pipe.on('crash', (data) => {
      clearTimeout(timeoutId)
      resolve(data.exitCode)
    })
  })

  os.kill(pid)

  const td = await teardownPromise
  ok(td, 'teardown executed')

  const exitCode = await exitCodePromise
  is(exitCode, 124, 'exit code is 124')
})
