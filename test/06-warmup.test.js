'use strict'
const test = require('brittle')
const path = require('bare-path')
const Helper = require('./helper')

const warmup = path.join(Helper.localDir, 'test', 'fixtures', 'warmup')
const prefetch = path.join(Helper.localDir, 'test', 'fixtures', 'warmup-with-prefetch')
const appWithIgnore = path.join(Helper.localDir, 'test', 'fixtures', 'app-with-ignore')

test('stage warmup with entrypoints', async function ({ ok, is, plan, comment, teardown, timeout }) {
  timeout(180000)
  plan(4)

  const dir = warmup

  const helper = new Helper()
  teardown(() => helper.close(), { order: Infinity })
  await helper.ready()

  const id = Helper.getRandomId()

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

  const id = Helper.getRandomId()

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

test('stage with ignore', async function ({ ok, is, plan, teardown }) {
  const dir = appWithIgnore

  const helper = new Helper()
  teardown(() => helper.close(), { order: Infinity })
  await helper.ready()

  const id = Helper.getRandomId()

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

  is(stagingFiles.length, 3)
  ok(stagingFiles.includes('/package.json'))
  ok(stagingFiles.includes('/dep.js'))
  ok(stagingFiles.includes('/index.js'))
})
