'use strict'
const test = require('brittle')
const Helper = require('./helper')

test('basic shutdown file lock', async function ({ is, plan }) {
  plan(1)
  const helper = new Helper()
  await helper.ready()
  await helper.shutdown()
  const unlocked = await Helper.accessLock()
  is(unlocked, true, 'platform file is not locked')
})
