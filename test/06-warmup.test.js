'use strict'
const test = require('brittle')
const path = require('bare-path')
const Helper = require('./helper')

const Hyperswarm = require('hyperswarm')
const Corestore = require('corestore')
const RAM = require('random-access-memory')
const Hyperdrive = require('hyperdrive')

const warmup = path.join(Helper.localDir, 'test', 'fixtures', 'warmup')
const desktop = path.join(Helper.localDir, 'test', 'fixtures', 'desktop-warmup')
const prefetch = path.join(Helper.localDir, 'test', 'fixtures', 'warmup-with-prefetch')
const appWithoutMain = path.join(Helper.localDir, 'test', 'fixtures', 'app-without-main')
const appWithIgnore = path.join(Helper.localDir, 'test', 'fixtures', 'app-with-ignore')

test('stage warmup with entrypoints', async function ({ ok, is, plan, comment, teardown, timeout }) {
  timeout(180000)
  plan(4)

  const dir = warmup

  const helper = new Helper()
  teardown(() => helper.close(), { order: Infinity })
  await helper.ready()

  const id = Math.floor(Math.random() * 10000)

  comment('staging')
  const staging = helper.stage({ channel: `test-${id}`, name: `test-${id}`, dir, dryRun: false })
  teardown(() => Helper.teardownStream(staging))

  const staged = await Helper.pick(staging, [{ tag: 'warming' }, { tag: 'final' }])
  const warming = await staged.warming
  ok((await staged.final).success, 'stage succeeded')

  ok(warming.blocks > 0, 'Warmup contains some blocks')
  ok(warming.total > 0, 'Warmup total is correct')
  is(warming.success, true, 'Warmup completed')
})

test('stage desktop app warmup with entrypoints', async function ({ ok, is, plan, comment, teardown, timeout }) {
  timeout(180000)
  plan(4)

  const dir = desktop

  const helper = new Helper()
  teardown(() => helper.close(), { order: Infinity })
  await helper.ready()

  const id = Math.floor(Math.random() * 10000)

  comment('staging')
  const staging = helper.stage({ channel: `test-${id}`, name: `test-${id}`, dir, dryRun: false })
  teardown(() => Helper.teardownStream(staging))

  const staged = await Helper.pick(staging, [{ tag: 'warming' }, { tag: 'final' }])
  const warming = await staged.warming
  ok((await staged.final).success, 'stage succeeded')

  ok(warming.blocks > 0, 'Warmup contains some blocks')
  ok(warming.total > 0, 'Warmup total is correct')
  is(warming.success, true, 'Warmup completed')
})

test('stage warmup with prefetch', async function ({ ok, is, plan, comment, teardown, timeout }) {
  timeout(180000)
  plan(4)

  const dir = prefetch

  const helper = new Helper()
  teardown(() => helper.close(), { order: Infinity })
  await helper.ready()

  const id = Math.floor(Math.random() * 10000)

  comment('staging')
  const staging = helper.stage({ channel: `test-${id}`, name: `test-${id}`, dir, dryRun: false })
  teardown(() => Helper.teardownStream(staging))

  const staged = await Helper.pick(staging, [{ tag: 'warming' }, { tag: 'final' }])
  const warming = await staged.warming
  ok((await staged.final).success, 'stage succeeded')

  ok(warming.blocks > 0, 'Warmup contains some blocks')
  ok(warming.total > 0, 'Warmup total is correct')
  is(warming.success, true, 'Warmup completed')
})

test('staged bundle contains entries metadata', async function ({ ok, is, plan, comment, teardown, timeout }) {
  plan(2)

  const dir = appWithoutMain

  const helper = new Helper()
  teardown(() => helper.close(), { order: Infinity })
  await helper.ready()

  const id = Math.floor(Math.random() * 10000)

  comment('staging')
  const staging = helper.stage({ channel: `test-${id}`, name: `test-${id}`, dir, dryRun: false })
  teardown(() => Helper.teardownStream(staging))

  const staged = await Helper.pick(staging, [{ tag: 'warming' }, { tag: 'final' }])
  await staged.final

  comment('seeding')
  const seeding = helper.seed({ channel: `test-${id}`, name: `test-${id}`, dir, key: null, cmdArgs: [] })
  teardown(() => Helper.teardownStream(seeding))
  const until = await Helper.pick(seeding, [{ tag: 'key' }, { tag: 'announced' }])
  const key = await until.key
  await until.announced

  const swarm = new Hyperswarm({ bootstrap: Pear.config.dht.bootstrap })
  const store = new Corestore(RAM)
  await store.ready()
  const drive = new Hyperdrive(store, key)
  await drive.ready()

  teardown(() => swarm.destroy())

  swarm.on('connection', (conn) => {
    drive.corestore.replicate(conn)
  })

  swarm.join(drive.discoveryKey)

  await new Promise((resolve) => setTimeout(resolve, 500))

  comment('bundle entries should contain metadata')
  for await (const file of drive.list()) {
    if (file.key === '/app.js' || file.key === '/dep.js') {
      const entry = await drive.entry(file.key)
      ok(entry.value.metadata)
    }
  }
})

test('stage with ignore', async function ({ ok, is, plan, teardown }) {
  const dir = appWithIgnore

  const helper = new Helper()
  teardown(() => helper.close(), { order: Infinity })
  await helper.ready()

  const id = Math.floor(Math.random() * 10000)

  const staging = helper.stage({ channel: `test-${id}`, name: `test-${id}`, dir, dryRun: false })
  teardown(() => Helper.teardownStream(staging))

  const stagingFiles = []
  staging.on('data', async (data) => {
    if (data?.tag === 'byte-diff') {
      stagingFiles.push(data.data.message)
    }
  })

  const staged = await Helper.pick(staging, [{ tag: 'final' }])
  await staged.final

  is(stagingFiles.length, 4)
  ok(stagingFiles.includes('/package.json'))
  ok(stagingFiles.includes('/dep.js'))
  ok(stagingFiles.includes('/app.js'))
  ok(stagingFiles.includes('/index.html'))
})
