'use strict'
const { isWindows } = require('which-runtime')
const test = require('brittle')
const os = require('bare-os')
const hypercoreid = require('hypercore-id-encoding')
const Helper = require('./helper')

test(
  'teardown on pipe end',
  { skip: isWindows },
  async function ({ ok, is, plan, comment, teardown, timeout }) {
    timeout(180000)
    plan(4)

    const dir = Helper.fixture('teardown')

    const helper = new Helper()
    teardown(() => helper.close(), { order: Infinity })
    await helper.ready()

    const id = Helper.getRandomId()

    comment('staging')
    const staging = helper.stage({
      channel: `test-${id}`,
      name: `test-${id}`,
      dir,
      dryRun: false
    })
    teardown(() => Helper.teardownStream(staging))
    const staged = await Helper.pick(staging, { tag: 'final' })
    ok(staged.success, 'stage succeeded')

    comment('seeding')
    const seeding = helper.seed({
      channel: `test-${id}`,
      name: `test-${id}`,
      dir,
      key: null,
      cmdArgs: []
    })
    teardown(() => Helper.teardownStream(seeding))
    const until = await Helper.pick(seeding, [
      { tag: 'key' },
      { tag: 'announced' }
    ])
    const announced = await until.announced
    ok(announced, 'seeding is announced')

    const key = await until.key
    ok(hypercoreid.isValid(key), 'app key is valid')

    const link = `pear://${key}`
    const run = await Helper.run({ link })
    const { pipe } = run

    const td = await Helper.untilResult(pipe, {
      timeout: 5000,
      runFn: () => {
        pipe.end()
      }
    })
    is(td, 'teardown', 'teardown executed')
  }
)

test(
  'teardown on os kill',
  { skip: isWindows },
  async function ({ ok, is, plan, comment, teardown, timeout }) {
    timeout(180000)
    plan(5)

    const dir = Helper.fixture('teardown-os-kill')

    const helper = new Helper()
    teardown(() => helper.close(), { order: Infinity })
    await helper.ready()

    const id = Helper.getRandomId()

    comment('staging')
    const staging = helper.stage({
      channel: `test-${id}`,
      name: `test-${id}`,
      dir,
      dryRun: false
    })
    teardown(() => Helper.teardownStream(staging))
    const staged = await Helper.pick(staging, { tag: 'final' })
    ok(staged.success, 'stage succeeded')

    comment('seeding')
    const seeding = helper.seed({
      channel: `test-${id}`,
      name: `test-${id}`,
      dir,
      key: null,
      cmdArgs: []
    })
    teardown(() => Helper.teardownStream(seeding))
    const until = await Helper.pick(seeding, [
      { tag: 'key' },
      { tag: 'announced' }
    ])
    const announced = await until.announced
    ok(announced, 'seeding is announced')

    const key = await until.key
    ok(hypercoreid.isValid(key), 'app key is valid')

    const link = `pear://${key}`
    const run = await Helper.run({ link })
    const { pipe } = run
    pipe.on('error', (err) => {
      if (err.code === 'ENOTCONN') return
      throw err
    })

    const pid = +(await Helper.untilResult(pipe))
    ok(pid > 0, 'pid is valid')

    const td = await Helper.untilResult(pipe, {
      timeout: 5000,
      runFn: () => os.kill(pid)
    })
    ok(td, 'teardown executed')
  }
)

test(
  'teardown on os kill',
  { skip: isWindows },
  async function ({ ok, is, plan, comment, teardown, timeout }) {
    timeout(180000)
    plan(6)

    const dir = Helper.fixture('teardown-exit-code')

    const helper = new Helper()
    teardown(() => helper.close(), { order: Infinity })
    await helper.ready()

    const id = Helper.getRandomId()

    comment('staging')
    const staging = helper.stage({
      channel: `test-${id}`,
      name: `test-${id}`,
      dir,
      dryRun: false
    })
    teardown(() => Helper.teardownStream(staging))
    const staged = await Helper.pick(staging, { tag: 'final' })
    ok(staged.success, 'stage succeeded')

    comment('seeding')
    const seeding = helper.seed({
      channel: `test-${id}`,
      name: `test-${id}`,
      dir,
      key: null,
      cmdArgs: []
    })
    teardown(() => Helper.teardownStream(seeding))
    const until = await Helper.pick(seeding, [
      { tag: 'key' },
      { tag: 'announced' }
    ])
    const announced = await until.announced
    ok(announced, 'seeding is announced')

    const key = await until.key
    ok(hypercoreid.isValid(key), 'app key is valid')

    const link = `pear://${key}`
    const run = await Helper.run({ link })
    const { pipe } = run
    pipe.on('error', (err) => {
      if (err.code === 'ENOTCONN') return
      throw err
    })

    const pid = +(await Helper.untilResult(pipe))
    ok(pid > 0, 'pid is valid')

    const pipeClosed = new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => reject(new Error('timed out')), 5000)
      pipe.on('close', () => {
        clearTimeout(timeoutId)
        resolve()
      })
    })

    const td = await Helper.untilResult(pipe, {
      timeout: 5000,
      runFn: () => os.kill(pid)
    })
    ok(td, 'teardown executed')

    await pipeClosed
    ok(td, 'pipe closed')
  }
)

test('teardown unloading resolves on sidecar-side teardown', async function ({
  ok,
  pass,
  plan,
  comment,
  teardown
}) {
  plan(4)

  const dir = Helper.fixture('unloading')

  const helper = new Helper()
  teardown(() => helper.close(), { order: Infinity })
  await helper.ready()

  const id = Helper.getRandomId()

  comment('staging')
  const staging = helper.stage({
    channel: `test-${id}`,
    name: `test-${id}`,
    dir,
    dryRun: false
  })
  teardown(() => Helper.teardownStream(staging))
  const staged = await Helper.pick(staging, { tag: 'final' })
  ok(staged.success, 'stage succeeded')

  comment('seeding')
  const seeding = helper.seed({
    channel: `test-${id}`,
    name: `test-${id}`,
    dir,
    key: null,
    cmdArgs: []
  })
  teardown(() => Helper.teardownStream(seeding))
  const until = await Helper.pick(seeding, [
    { tag: 'key' },
    { tag: 'announced' }
  ])
  const announced = await until.announced
  ok(announced, 'seeding is announced')

  const key = await until.key
  ok(hypercoreid.isValid(key), 'app key is valid')

  const link = `pear://${key}`
  const { pipe } = await Helper.run({ link })
  pipe.on('error', (err) => {
    if (err.code === 'ENOTCONN') return
    throw err
  })
  const pid = +(await Helper.untilResult(pipe))
  await Pear[Pear.constructor.IPC].closeClients() // triggers teardown from sidecar, preserves test runner ipc client
  pass('unloading resolved')
  os.kill(pid)
})

test('teardown unloading - run of run identify as subapp', async function ({
  ok,
  is,
  plan,
  comment,
  teardown
}) {
  plan(4)

  const dir = Helper.fixture('run-of-identify-unloading')

  const helper = new Helper()
  teardown(() => helper.close(), { order: Infinity })
  await helper.ready()

  const id = Helper.getRandomId()

  comment('staging')
  const staging = helper.stage({
    channel: `test-${id}`,
    name: `test-${id}`,
    dir,
    dryRun: false
  })
  teardown(() => Helper.teardownStream(staging))
  const staged = await Helper.pick(staging, { tag: 'final' })
  ok(staged.success, 'stage succeeded')

  comment('seeding')
  const seeding = helper.seed({
    channel: `test-${id}`,
    name: `test-${id}`,
    dir,
    key: null,
    cmdArgs: []
  })
  teardown(() => Helper.teardownStream(seeding))
  const until = await Helper.pick(seeding, [
    { tag: 'key' },
    { tag: 'announced' }
  ])
  const announced = await until.announced
  ok(announced, 'seeding is announced')

  const key = await until.key
  ok(hypercoreid.isValid(key), 'app key is valid')

  const link = `pear://${key}`
  const { pipe } = await Helper.run({ link })
  pipe.on('error', (err) => {
    if (err.code === 'ENOTCONN') return
    throw err
  })
  const status = await Helper.untilData(pipe)
  is(status.toString(), 'unloading')
})

test('forced teardown', async function ({
  ok,
  is,
  plan,
  comment,
  teardown,
  timeout,
  pass
}) {
  timeout(30000)
  plan(4)

  const dir = Helper.fixture('teardown-timeout')

  const helper = new Helper()
  teardown(() => helper.close(), { order: Infinity })
  await helper.ready()

  const id = Helper.getRandomId()

  comment('staging')
  const staging = helper.stage({
    channel: `test-${id}`,
    name: `test-${id}`,
    dir,
    dryRun: false
  })
  teardown(() => Helper.teardownStream(staging))
  const staged = await Helper.pick(staging, { tag: 'final' })
  ok(staged.success, 'stage succeeded')

  comment('seeding')
  const seeding = helper.seed({
    channel: `test-${id}`,
    name: `test-${id}`,
    dir,
    key: null,
    cmdArgs: []
  })
  teardown(() => Helper.teardownStream(seeding))
  const until = await Helper.pick(seeding, [
    { tag: 'key' },
    { tag: 'announced' }
  ])
  const announced = await until.announced
  ok(announced, 'seeding is announced')

  const key = await until.key
  ok(hypercoreid.isValid(key), 'app key is valid')

  const link = `pear://${key}`
  const run = await Helper.run({ link })
  const { pipe } = run

  pipe.on('error', () => {})

  comment('waiting for max teardown')
  pipe.on('close', () => {
    pass('forced teardown')
  })
})

test('teardown after exception', async function ({
  ok,
  is,
  plan,
  comment,
  teardown,
  timeout,
  pass
}) {
  timeout(10000)
  plan(4)

  const dir = Helper.fixture('teardown-after-exception')

  const helper = new Helper()
  teardown(() => helper.close(), { order: Infinity })
  await helper.ready()

  const id = Helper.getRandomId()

  comment('staging')
  const staging = helper.stage({
    channel: `test-${id}`,
    name: `test-${id}`,
    dir,
    dryRun: false
  })
  teardown(() => Helper.teardownStream(staging))
  const staged = await Helper.pick(staging, { tag: 'final' })
  ok(staged.success, 'stage succeeded')

  comment('seeding')
  const seeding = helper.seed({
    channel: `test-${id}`,
    name: `test-${id}`,
    dir,
    key: null,
    cmdArgs: []
  })
  teardown(() => Helper.teardownStream(seeding))
  const until = await Helper.pick(seeding, [
    { tag: 'key' },
    { tag: 'announced' }
  ])
  const announced = await until.announced
  ok(announced, 'seeding is announced')

  const key = await until.key
  ok(hypercoreid.isValid(key), 'app key is valid')

  const link = `pear://${key}`
  const run = await Helper.run({ link })
  const { pipe } = run

  pipe.on('error', () => {})

  const td = await Helper.untilResult(pipe)
  is(td, 'teardown')
})

test('exception during teardown', async function ({
  ok,
  plan,
  comment,
  teardown,
  timeout,
  pass
}) {
  timeout(10000)
  plan(4)

  const dir = Helper.fixture('teardown-exception')

  const helper = new Helper()
  teardown(() => helper.close(), { order: Infinity })
  await helper.ready()

  const id = Helper.getRandomId()

  comment('staging')
  const staging = helper.stage({
    channel: `test-${id}`,
    name: `test-${id}`,
    dir,
    dryRun: false
  })
  teardown(() => Helper.teardownStream(staging))
  const staged = await Helper.pick(staging, { tag: 'final' })
  ok(staged.success, 'stage succeeded')

  comment('seeding')
  const seeding = helper.seed({
    channel: `test-${id}`,
    name: `test-${id}`,
    dir,
    key: null,
    cmdArgs: []
  })
  teardown(() => Helper.teardownStream(seeding))
  const until = await Helper.pick(seeding, [
    { tag: 'key' },
    { tag: 'announced' }
  ])
  const announced = await until.announced
  ok(announced, 'seeding is announced')

  const key = await until.key
  ok(hypercoreid.isValid(key), 'app key is valid')

  const link = `pear://${key}`
  const run = await Helper.run({ link })
  const { pipe } = run

  pipe.on('error', () => {})

  pipe.on('close', () => {
    pass('forced teardown')
  })
})
