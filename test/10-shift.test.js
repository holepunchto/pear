'use strict'
const test = require('brittle')
const path = require('bare-path')
const Helper = require('./helper')
const storageDir = path.join(Helper.localDir, 'test', 'fixtures', 'storage')

test('pear shift should fail with invalid src', async function ({
  absent,
  plan,
  comment,
  teardown
}) {
  plan(1)

  const helper = new Helper()
  teardown(() => helper.close(), { order: Infinity })
  await helper.ready()

  comment('staging dst app')
  const stageLink1 = await Helper.touchLink(helper)
  const staging1 = helper.stage({
    link: stageLink1,
    dir: storageDir,
    dryRun: false,
    bare: true
  })
  teardown(() => Helper.teardownStream(staging1))
  const staged1 = await Helper.pick(staging1, [{ tag: 'addendum' }, { tag: 'final' }])
  const { key: key1 } = await staged1.addendum
  await staged1.final

  const dst = `pear://${key1}`

  const shift = helper.shift({ src: 'pear://', dst, force: true })
  const untilShift = await Helper.pick(shift, [{ tag: 'error' }])
  const error = await untilShift.error

  absent(error.success, 'should error')
})

test('pear shift should fail with invalid dst', async function ({
  absent,
  plan,
  comment,
  teardown
}) {
  plan(1)

  const helper = new Helper()
  teardown(() => helper.close(), { order: Infinity })
  await helper.ready()

  comment('staging src app')
  const stageLink1 = await Helper.touchLink(helper)
  const staging1 = helper.stage({
    link: stageLink1,
    dir: storageDir,
    dryRun: false,
    bare: true
  })
  teardown(() => Helper.teardownStream(staging1))
  const staged1 = await Helper.pick(staging1, [{ tag: 'addendum' }, { tag: 'final' }])
  const { key: key1 } = await staged1.addendum
  await staged1.final

  const src = `pear://${key1}`

  const shift = helper.shift({ src, dst: 'pear://', force: true })
  const untilShift = await Helper.pick(shift, [{ tag: 'error' }])
  const error = await untilShift.error

  absent(error.success, 'should error')
})

test('pear shift should fail when src app storage does not exist', async function ({
  absent,
  plan,
  comment,
  teardown
}) {
  plan(1)

  const helper = new Helper()
  teardown(() => helper.close(), { order: Infinity })
  await helper.ready()

  comment('staging src app')
  const stageLink1 = await Helper.touchLink(helper)
  const staging1 = helper.stage({
    link: stageLink1,
    dir: storageDir,
    dryRun: false,
    bare: true
  })
  teardown(() => Helper.teardownStream(staging1))
  const staged1 = await Helper.pick(staging1, [{ tag: 'addendum' }, { tag: 'final' }])
  const { key: key1 } = await staged1.addendum
  await staged1.final

  const src = `pear://${key1}`

  const shift = helper.shift({ src, dst: 'pear://', force: true })
  const untilShift = await Helper.pick(shift, [{ tag: 'error' }])
  const error = await untilShift.error

  absent(error.success, 'should error')
})
