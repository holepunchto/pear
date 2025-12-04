'use strict'
const test = require('brittle')
const path = require('bare-path')
const b4a = require('b4a')
const { ERR_INVALID_LINK } = require('pear-errors')
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

test('pear drop: invalid links do not crash the sidecar', async (t) => {
  t.plan(2)

  const invalidLinksAndExpectedError = [
    [{}, ERR_INVALID_LINK],
    [{ id: 'invalid-link' }, ERR_INVALID_LINK],
    [0, ERR_INVALID_LINK],
    [1, ERR_INVALID_LINK],
    [null, ERR_INVALID_LINK],
    [true, ERR_INVALID_LINK],
    [false, ERR_INVALID_LINK],
    [b4a.allocUnsafe(8), ERR_INVALID_LINK]
  ]
  const links = invalidLinksAndExpectedError.map((i) => i[0])
  const expectedErrorCodes = invalidLinksAndExpectedError.map((i) => i[1].name)

  const helper = new Helper()
  t.teardown(() => helper.close(), { order: Infinity })
  await helper.ready()

  const actualErrorCodes = []
  for (const link of links) {
    const stream = helper.drop({ link })
    try {
      await Helper.pick(stream, { tag: 'final' })
      actualErrorCodes.push(null)
    } catch (e) {
      actualErrorCodes.push(e.code)
    }
  }
  t.alike(actualErrorCodes, expectedErrorCodes)
  t.comment('sidecar does not crash')
  t.is(helper.closed, false)
})
