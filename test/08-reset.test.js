'use strict'
const test = require('brittle')
const path = require('bare-path')
const tmp = require('test-tmp')
const Helper = require('./helper')
const storageDir = path.join(Helper.localDir, 'test', 'fixtures', 'storage')
const presetsDir = path.join(Helper.localDir, 'test', 'fixtures', 'presets')

test('reset', async function ({ ok, is, plan, comment, teardown, timeout }) {
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

  const run = await Helper.run({ link })
  const before = await Helper.untilResult(run.pipe)
  await Helper.untilClose(run.pipe)

  const reset = await helper.reset({ link })
  const untilReset = await Helper.pick(reset, [{ tag: 'complete' }])
  await untilReset.complete

  const runB = await Helper.run({ link })
  const after = await Helper.untilResult(runB.pipe)
  await Helper.untilClose(runB.pipe)

  ok(before)
  ok(after)
  ok(before !== after)
})

test('preset reset', async function ({ ok, is, plan, teardown, timeout }) {
  timeout(180000)
  plan(4)

  const dir = presetsDir

  const helper = new Helper()
  teardown(() => helper.close(), { order: Infinity })
  await helper.ready()

  const id = Helper.getRandomId()

  const staging = helper.stage({ channel: `test-${id}`, name: `test-${id}`, dir, dryRun: false, bare: true })
  teardown(() => Helper.teardownStream(staging))
  const staged = await Helper.pick(staging, [{ tag: 'addendum' }, { tag: 'final' }])
  const { key } = await staged.addendum
  await staged.final

  const link = `pear://${key}`

  const run = await Helper.run({ link })
  await Helper.untilClose(run.pipe)

  const data = await helper.data({ resource: 'link', link })
  const result = await Helper.pick(data, [{ tag: 'link' }])
  const appData = await result.link
  is(appData.preset, null, 'app preset is null by default')

  const tmpdir = await tmp()
  const presets = await helper.presets({ link, flags: { tmpStore: tmpdir, dev: true } })
  teardown(() => Helper.teardownStream(presets))
  const untilUpdated = await Helper.pick(presets, [{ tag: 'updated' }])
  await untilUpdated.updated

  const dataBeforePresetReset = await helper.data({ resource: 'link', link })
  const resultBeforePresetReset = await Helper.pick(dataBeforePresetReset, [{ tag: 'link' }])
  const appDataBeforePresetReset = await resultBeforePresetReset.link
  ok(appDataBeforePresetReset.preset !== null, 'app preset is set')

  const reset = await helper.reset({ link, preset: true })
  const untilReset = await Helper.pick(reset, [{ tag: 'complete' }])
  await untilReset.complete

  const dataAfterPresetReset = await helper.data({ resource: 'link', link })
  const resultAfterPresetReset = await Helper.pick(dataAfterPresetReset, [{ tag: 'link' }])
  const appDataAfterPresetReset = await resultAfterPresetReset.link

  ok(appDataAfterPresetReset.preset === null, 'app preset has been reset')
  ok(appDataAfterPresetReset.storage === appDataBeforePresetReset.storage, 'app storage does not change')
})
