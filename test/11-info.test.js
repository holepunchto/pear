'use strict'
const test = require('brittle')
const Helper = require('./helper')

test('info but skip link arg', async function ({ pass, fail, plan, teardown, comment }) {
  plan(1)

  const helper = new Helper()
  teardown(() => helper.close(), { order: Infinity })
  await helper.ready()

  try {
    comment('getting info')
    const infoStream = await helper.info({ dir: '/path/to/dir' })
    await Helper.opwait(infoStream)
    pass()
  } catch (err) {
    console.error(err)
    fail()
  }
})
