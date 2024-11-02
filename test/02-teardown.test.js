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
  plan(5)

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

  const pidPromise = new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => reject(new Error('timed out')), 5000)
    pipe.on('data', (data) => {
      clearTimeout(timeoutId)
      const res = JSON.parse(data.toString())
      if (res.id === 'pid') resolve(res.value)
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

  const teardownPromise = new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => reject(new Error('timed out')), 5000)
    pipe.on('data', (data) => {
      clearTimeout(timeoutId)
      const res = JSON.parse(data.toString())
      if (res.id === 'teardown') resolve(true)
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

  pipe.write('start')
  
  const pid = await pidPromise
  ok(pid > 0, 'worker pid is valid')
  
  os.kill(pid)

  const td = await teardownPromise
  ok(td, 'teardown executed')
})

// TODO: this test will not work because in lib/teardown, 'handlers' is cloned to 'order', 
// so mutating 'handlers' will not affect 'order'
test.skip('teardown during teardown', async function ({ ok, is, plan, comment, teardown, timeout }) {
  timeout(180000)
  plan(5)

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
  const { pipe } = run

  const pidPromise = new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => reject(new Error('timed out')), 5000)
    pipe.on('data', (data) => {
      clearTimeout(timeoutId)
      const res = JSON.parse(data.toString())
      if (res.id === 'pid') resolve(res.value)
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

  const teardownPromise = new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => reject(new Error('timed out')), 5000)
    pipe.on('data', (data) => {
      clearTimeout(timeoutId)
      const res = JSON.parse(data.toString())
      if (res.id === 'teardown') resolve(true)
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

  pipe.write('start')
  
  const pid = await pidPromise
  ok(pid > 0, 'worker pid is valid')
  
  os.kill(pid)

  const td = await teardownPromise
  ok(td, 'teardown executed')
})

test('exit with non-zero code in teardown', async function ({ ok, is, plan, comment, teardown, timeout }) {
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

  const pidPromise = new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => reject(new Error('timed out')), 5000)
    pipe.on('data', (data) => {
      clearTimeout(timeoutId)
      const res = JSON.parse(data.toString())
      if (res.id === 'pid') resolve(res.value)
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

  const teardownPromise = new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => reject(new Error('timed out')), 5000)
    pipe.on('data', (data) => {
      clearTimeout(timeoutId)
      const res = JSON.parse(data.toString())
      if (res.id === 'teardown') resolve(true)
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

  pipe.write('start')
  
  const pid = await pidPromise
  ok(pid > 0, 'worker pid is valid')
  
  os.kill(pid)

  const td = await teardownPromise
  ok(td, 'teardown executed')

  const exitCode = await exitCodePromise
  is(exitCode, 124, 'exit code is 124')
})
