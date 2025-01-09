'use strict'
const test = require('brittle')
const path = require('bare-path')
const Helper = require('./helper')

const resetDir = path.join(Helper.localDir, 'test', 'fixtures', 'reset')

test.solo('reset', async function ({ ok, comment, teardown, timeout }) {
  timeout(180000)

  const dir = resetDir

  const helper = new Helper()
  teardown(() => helper.close(), { order: Infinity })
  await helper.ready()

  const id = Math.floor(Math.random() * 10000)

  comment('staging')
  const staging = helper.stage({ channel: `test-${id}`, name: `test-${id}`, dir, dryRun: false, bare: true })
  teardown(() => Helper.teardownStream(staging))
  const staged = await Helper.pick(staging, [{ tag: 'addendum' }, { tag: 'final' }])
  const { key } = await staged.addendum
  await staged.final

  const link = `pear://${key}`
  const runA = await Helper.run({ link })
  const resultA = await Helper.untilResult(runA.pipe)
  const oldAppStorage = resultA

  const reset = await helper.reset({ link })

  const runB = await Helper.run({ link })
  const resultB = await Helper.untilResult(runB.pipe)
  const newAppStorage = resultB

  await Helper.untilClose(runA.pipe)
  await Helper.untilClose(runB.pipe)

  ok(oldAppStorage)
  ok(newAppStorage)
  ok(oldAppStorage !== newAppStorage)

  ok(true, 'ended')

  Helper.teardownStream(reset)
})
