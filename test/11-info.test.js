'use strict'
const test = require('brittle')
const Helper = require('./helper')

test('Pear.info but skip link arg', async function ({ teardown, execution, plan, comment }) {
  plan(1)

  const helper = new Helper()
  teardown(() => helper.close(), { order: Infinity })
  await helper.ready()

  comment('calling info')
  const info = await helper.info({ dir: '/path/to/dir' })
  await execution(async () => {await opwait(info)})
})
