'use strict'
const test = require('brittle')
const opwait = require('pear-api/opwait')
const Helper = require('./helper')
const skippingInfoLinkDir = path.join(Helper.localDir, 'test', 'fixtures', 'skipping-info-link')

test('Pear.info but skip link arg', async function ({ execution, plan, teardown, comment }) {
  plan(1)

  const helper = new Helper()
  teardown(() => helper.close(), { order: Infinity })
  await helper.ready()

  comment('getting info')
  const info = await helper.info({ dir: '/path/to/dir' })
  await execution(async () => {await opwait(info)})
})
