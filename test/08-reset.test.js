'use strict'
const test = require('brittle')
const path = require('bare-path')
const Helper = require('./helper')
const storageDir = path.join(Helper.localDir, 'test', 'fixtures', 'storage')

test('reset', async function ({ ok, not, plan, comment, teardown, timeout }) {
  timeout(180000)
  plan(3)

  const dir = storageDir

  const helper = new Helper()
  teardown(() => helper.close(), { order: Infinity })
  await helper.ready()

  const id = Helper.getRandomId()

  comment('staging')
  const staging = helper.stage({ channel: `test-${id}`, name: `test-${id}`, dir, dryRun: false, bare: true })
  teardown(() => Helper.teardownStream(staging))
  const staged = await Helper.pick(staging, [{ tag: 'addendum' }, { tag: 'final' }])
  const { key } = await staged.addendum
  await staged.final

  const link = `pear://${key}`

  comment('running')

  const run = await Helper.run({ link })
  const before = await Helper.untilResult(run.pipe)
  await Helper.untilClose(run.pipe)

  comment('resetting')

  const reset = helper.reset({ link })
  const untilReset = await Helper.pick(reset, [{ tag: 'complete' }])
  await untilReset.complete

  comment('running')

  const runB = await Helper.run({ link })
  const after = await Helper.untilResult(runB.pipe)
  await Helper.untilClose(runB.pipe)

  ok(before)
  ok(after)
  not(before, after)
})
