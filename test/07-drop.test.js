'use strict'
const test = require('brittle')
const path = require('bare-path')
const b4a = require('b4a')
const Helper = require('./helper')
const storageDir = path.join(Helper.localDir, 'test', 'fixtures', 'storage')

test('drop', async function ({ ok, not, plan, comment, teardown, timeout }) {
  timeout(180000)
  plan(3)

  const dir = storageDir

  const helper = new Helper()
  teardown(() => helper.close(), { order: Infinity })
  await helper.ready()

  const id = Helper.getRandomId()

  comment('staging')
  const staging = helper.stage({
    channel: `test-${id}`,
    name: `test-${id}`,
    dir,
    dryRun: false,
    bare: true
  })
  teardown(() => Helper.teardownStream(staging))
  const staged = await Helper.pick(staging, [
    { tag: 'addendum' },
    { tag: 'final' }
  ])
  const { key } = await staged.addendum
  await staged.final

  const link = `pear://${key}`

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

test('pear drop: link validation', async (t) => {
  t.plan(2)

  const links = [
    {},
    { id: 'invalid-link' },
    0,
    1,
    null,
    true,
    false,
    b4a.allocUnsafe(8)
  ]
  const expectedErrors = links.map(() => 'ERR_INVALID_LINK')

  const helper = new Helper()
  t.teardown(() => helper.close(), { order: Infinity })
  await helper.ready()

  const actualErrors = []
  for (const link of links) {
    const stream = helper.drop({ link })
    try {
      await Helper.pick(stream, { tag: 'final' })
      actualErrors.push(null)
    } catch (e) {
      actualErrors.push(e.code)
    }
  }
  t.alike(actualErrors, expectedErrors, 'links validated')
  t.is(helper.closed, false)
})
