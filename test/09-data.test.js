'use strict'
const test = require('brittle')
const path = require('bare-path')
const Helper = require('./helper')
const storageDir = path.join(Helper.localDir, 'test', 'fixtures', 'storage')

test('pear data', async function ({ ok, is, plan, comment, teardown, timeout }) {
  timeout(180000)
  plan(0)

  const dir = storageDir
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
  const run = await Helper.run({ link })
  await Helper.untilClose(run.pipe)

  const data = await helper.data({ resource: 'apps' })
  const untilData = await Helper.pick(data, [{ tag: 'complete' }])
  await untilData.complete
})
