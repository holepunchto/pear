'use strict'
const test = require('brittle')
const path = require('bare-path')
const Helper = require('./helper')

const warmup = path.join(Helper.localDir, 'test', 'fixtures', 'warmup')

test('app with assets in sub dep', async function ({ ok, is, plan, comment, teardown, timeout }) {
  timeout(180000)
  plan(4)

  const dir = warmup

  const helper = new Helper()
  teardown(() => helper.close(), { order: Infinity })
  await helper.ready()

  const id = Math.floor(Math.random() * 10000)

  comment('staging')
  const staging = helper.stage({ channel: `test-${id}`, name: `test-${id}`, dir, dryRun: false, bare: true })
  teardown(() => Helper.teardownStream(staging))

  const staged = await Helper.pick(staging, [{ tag: 'warming' }, { tag: 'final' }])
  const warming = await staged.warming
  ok((await staged.final).success, 'stage succeeded')

  ok(warming.blocks > 0, 'Warmup contains some blocks')
  ok(warming.total > 0, 'Warmup total is correct')
  is(warming.success, true, 'Warmup completed')
})
