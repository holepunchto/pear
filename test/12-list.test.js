'use strict'
const test = require('brittle')
const Helper = require('./helper')

test('pear list default cores', async ({ teardown, plan, is, ok }) => {
  plan(6)
  const helper = new Helper()
  teardown(() => helper.close(), { order: Infinity })
  await helper.ready()
  const listing = helper.list()
  const listed = await Helper.pick(listing, [{ tag: 'core' }, { tag: 'final' }])

  const core = await listed.core
  ok(/^[a-z0-9]{52}$/.test(core.id))
  ok(/^pear:\/\/[a-z0-9]{52}$/.test(core.link))
  is(typeof core.open, 'boolean')

  const result = await listed.final

  is(result.success, true)
  ok(result.count > 0)
  ok(result.open <= result.count)
})
