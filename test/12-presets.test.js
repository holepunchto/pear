const test = require('brittle')
const path = require('bare-path')
const Helper = require('./helper')
const tmp = require('test-tmp')

const presetsDir = path.join(Helper.localDir, 'test', 'fixtures', 'presets')

test('basic preset', async function (t) {
  const helper = new Helper()
  t.teardown(() => helper.close(), { order: Infinity })
  await helper.ready()

  const id = Helper.getRandomId()
  const dir = presetsDir

  const staging = helper.stage({ channel: `test-${id}`, name: `test-${id}`, dir, dryRun: false, bare: true })
  t.teardown(() => Helper.teardownStream(staging))
  const staged = await Helper.pick(staging, [{ tag: 'addendum' }, { tag: 'final' }])
  const { key } = await staged.addendum
  await staged.final

  const run = await Helper.run({ link: `pear://${key}` })
  const defaultFlags = JSON.parse(await Helper.untilResult(run.pipe))
  await Helper.untilClose(run.pipe)

  const tmpdir = await tmp()
  const presets = await helper.presets({ link: `pear://${key}`, flags: { tmpStore: tmpdir, dev: true } })
  t.teardown(() => Helper.teardownStream(presets))
  await Helper.pick(presets, [{ tag: 'info' }])

  const runB = await Helper.run({ link: `pear://${key}` })
  const presetFlags = JSON.parse(await Helper.untilResult(runB.pipe))
  await Helper.untilClose(runB.pipe)

  t.ok(defaultFlags.tmpStore === false)
  t.ok(defaultFlags.dev === false)
  t.ok(presetFlags.tmpStore !== false)
  t.ok(presetFlags.dev === true)

  const presetsInfo = await helper.presets({ link: `pear://${key}` })
  t.teardown(() => Helper.teardownStream(presetsInfo))
  const untilInfo = await Helper.pick(presetsInfo, [{ tag: 'info' }])
  const infoResult = await untilInfo.info

  t.ok(infoResult.tmpStore !== undefined)
  t.ok(infoResult.dev === true)
})
