'use strict'
const test = require('brittle')
const Helper = require('./helper')

test('pear cores lists default cores', async ({ teardown, plan, is, ok }) => {
  plan(6)
  const helper = new Helper()
  teardown(() => helper.close(), { order: Infinity })
  await helper.ready()
  const coresStream = helper.cores()
  const cores = await Helper.pick(coresStream, [{ tag: 'core' }, { tag: 'final' }])

  const core = await cores.core
  ok(/^[a-z0-9]{52}$/.test(core.id))
  ok(/^pear:\/\/[a-z0-9]{52}$/.test(core.link))
  is(typeof core.writable, 'boolean')

  const result = await cores.final

  is(result.success, true)
  ok(result.count > 0)
  ok(result.writable <= result.count)
})
