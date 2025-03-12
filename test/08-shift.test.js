'use strict'
const test = require('brittle')
const path = require('bare-path')
const Helper = require('./helper')
const storageDir = path.join(Helper.localDir, 'test', 'fixtures', 'storage')

test.solo('shift', async function ({ not, is, plan, comment, teardown }) {
  plan(2)

  const helper = new Helper()
  teardown(() => helper.close(), { order: Infinity })
  await helper.ready()

  comment('staging src app')
  const id1 = Math.floor(Math.random() * 10000)
  const staging1 = helper.stage({ channel: `test-${id1}`, name: `test-${id1}`, dir: storageDir, dryRun: false, bare: true })
  teardown(() => Helper.teardownStream(staging1))
  const staged1 = await Helper.pick(staging1, [{ tag: 'addendum' }, { tag: 'final' }])
  const { key: key1 } = await staged1.addendum
  await staged1.final

  const src = `pear://${key1}`

  const run1 = await Helper.run({ link: src })
  const oldSrc = await Helper.untilResult(run1.pipe)
  await Helper.untilClose(run1.pipe)

  comment('staging dst app')
  const id2 = Math.floor(Math.random() * 20000)
  const staging2 = helper.stage({ channel: `test-${id2}`, name: `test-${id2}`, dir: storageDir, dryRun: false, bare: true })
  teardown(() => Helper.teardownStream(staging2))
  const staged2 = await Helper.pick(staging2, [{ tag: 'addendum' }, { tag: 'final' }])
  const { key: key2 } = await staged2.addendum
  await staged2.final

  const dst = `pear://${key2}`

  const shift = helper.shift({ src, dst, force: true })
  const untilShift = await Helper.pick(shift, [{ tag: 'complete' }])
  await untilShift.complete

  const run2 = await Helper.run({ link: dst })
  const newDst = await Helper.untilResult(run2.pipe)
  await Helper.untilClose(run2.pipe)
  console.log(oldSrc, newDst)
  is(oldSrc, newDst, 'dst app storage should be the same as old src app storage')

  const run3 = await Helper.run({ link: src })
  const newSrc = await Helper.untilResult(run3.pipe)
  await Helper.untilClose(run3.pipe)

  not(oldSrc, newSrc, 'src app storage should be different after shift')
})

test('shift should fail with invalid src', async function ({ absent, plan, comment, teardown }) {
  plan(1)

  const helper = new Helper()
  teardown(() => helper.close(), { order: Infinity })
  await helper.ready()

  comment('staging dst app')
  const id1 = Math.floor(Math.random() * 10000)
  const staging1 = helper.stage({ channel: `test-${id1}`, name: `test-${id1}`, dir: storageDir, dryRun: false, bare: true })
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

test('shift should fail with invalid dst', async function ({ absent, plan, comment, teardown }) {
  plan(1)

  const helper = new Helper()
  teardown(() => helper.close(), { order: Infinity })
  await helper.ready()

  comment('staging src app')
  const id1 = Math.floor(Math.random() * 10000)
  const staging1 = helper.stage({ channel: `test-${id1}`, name: `test-${id1}`, dir: storageDir, dryRun: false, bare: true })
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

test('shift should fail when src app storage does not exist', async function ({ absent, plan, comment, teardown }) {
  plan(1)

  const helper = new Helper()
  teardown(() => helper.close(), { order: Infinity })
  await helper.ready()

  comment('staging src app')
  const id1 = Math.floor(Math.random() * 10000)
  const staging1 = helper.stage({ channel: `test-${id1}`, name: `test-${id1}`, dir: storageDir, dryRun: false, bare: true })
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

test('shift should fail when dst app storage already exists without force', async function ({ absent, plan, comment, teardown }) {
  plan(1)

  const helper = new Helper()
  teardown(() => helper.close(), { order: Infinity })
  await helper.ready()

  comment('staging src app')
  const id1 = Math.floor(Math.random() * 10000)
  const staging1 = helper.stage({ channel: `test-${id1}`, name: `test-${id1}`, dir: storageDir, dryRun: false, bare: true })
  teardown(() => Helper.teardownStream(staging1))
  const staged1 = await Helper.pick(staging1, [{ tag: 'addendum' }, { tag: 'final' }])
  const { key: key1 } = await staged1.addendum
  await staged1.final

  const src = `pear://${key1}`

  const id2 = Math.floor(Math.random() * 20000)
  const staging2 = helper.stage({ channel: `test-${id2}`, name: `test-${id2}`, dir: storageDir, dryRun: false, bare: true })
  teardown(() => Helper.teardownStream(staging2))
  const staged2 = await Helper.pick(staging2, [{ tag: 'addendum' }, { tag: 'final' }])
  const { key: key2 } = await staged2.addendum
  await staged2.final

  const dst = `pear://${key2}`

  const run1 = await Helper.run({ link: dst })
  await Helper.untilResult(run1.pipe)
  await Helper.untilClose(run1.pipe)

  const shift = helper.shift({ src, dst, force: false })
  const untilShift = await Helper.pick(shift, [{ tag: 'error' }])
  const error = await untilShift.error

  absent(error.success, 'should error')
})
