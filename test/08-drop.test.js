'use strict'
const test = require('brittle')
const Helper = require('./helper')

test('pear drop', async function ({ ok, not, plan, comment, teardown, timeout }) {
  timeout(180000)
  plan(3)

  const dir = Helper.fixture('storage')

  const helper = new Helper()
  teardown(() => helper.close(), { order: Infinity })
  await helper.ready()
  const link = await Helper.touchLink(helper)

  comment('staging')
  const staging = helper.stage({
    link,
    dir,
    dryRun: false,
    bare: true
  })
  teardown(() => Helper.teardownStream(staging))
  const staged = await Helper.pick(staging, [{ tag: 'addendum' }, { tag: 'final' }])
  await staged.addendum
  await staged.final

  comment('running')

  const run = await Helper.run({ link })
  const before = await Helper.untilResult(run.pipe)
  await Helper.untilClose(run.pipe)

  comment('dropping')

  const drop = helper.drop({ link })
  const untilDrop = await Helper.pick(drop, [{ tag: 'complete' }])
  await untilDrop.complete

  comment('running')

  const runB = await Helper.run({ link })
  const after = await Helper.untilResult(runB.pipe)
  await Helper.untilClose(runB.pipe)

  ok(before)
  ok(after)
  not(before, after)
})
