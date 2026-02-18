'use strict'
const test = require('brittle')
const hypercoreid = require('hypercore-id-encoding')
const Helper = require('./helper')

test('pear touch generates random pear links', async ({ teardown, plan, not, ok, is }) => {
  plan(8)
  const helper = new Helper()
  teardown(() => helper.close(), { order: Infinity })
  await helper.ready()
  const touching = helper.touch()
  const touched = await Helper.pick(touching, [{ tag: 'final' }])

  const result = await touched.final

  is(result.success, true)
  ok(hypercoreid.isValid(result.key))
  is(result.link, 'pear://' + result.key)

  const touching2 = helper.touch()
  const touched2 = await Helper.pick(touching2, [{ tag: 'final' }])

  const result2 = await touched2.final

  is(result2.success, true)
  ok(hypercoreid.isValid(result2.key))
  is(result2.link, 'pear://' + result2.key)
  not(result.link, result2.link)
  not(result.key, result2.key)
})

test('pear touch [dir] still generates random links', async ({ teardown, plan, ok, not, is }) => {
  plan(8)
  const helper = new Helper()
  teardown(() => helper.close(), { order: Infinity })
  await helper.ready()
  const dir = Helper.fixture('stage-app-min')
  const touching = helper.touch({ dir })
  const touched = await Helper.pick(touching, [{ tag: 'final' }])

  const result = await touched.final

  is(result.success, true)
  ok(hypercoreid.isValid(result.key))
  is(result.link, 'pear://' + result.key)

  const touching2 = helper.touch({ dir })
  const touched2 = await Helper.pick(touching2, [{ tag: 'final' }])

  const result2 = await touched2.final

  is(result2.success, true)
  ok(hypercoreid.isValid(result2.key))
  is(result2.link, 'pear://' + result2.key)
  not(result2.link, result.link)
  not(result.key, result2.key)
})
