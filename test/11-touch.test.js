'use strict'
const test = require('brittle')
const Helper = require('./helper')

test('pear touch generates clean pear link', async ({ teardown, plan, not, is }) => {
  plan(10)
  const helper = new Helper()
  teardown(() => helper.close(), { order: Infinity })
  await helper.ready()
  const touching = helper.touch()
  const touched = await Helper.pick(touching, [{ tag: 'final' }])

  const result = await touched.final

  is(result.success, true)
  is(result.length, 0)
  is(result.fork, 0)
  is(result.link, 'pear://' + result.key)

  const touching2 = helper.touch()
  const touched2 = await Helper.pick(touching2, [{ tag: 'final' }])

  const result2 = await touched2.final

  is(result2.success, true)
  is(result2.length, 0)
  is(result2.fork, 0)
  is(result2.link, 'pear://' + result2.key)
  not(result.link, result2.link)
  not(result.key, result2.key)
})

test('pear touch --dir is deterministic for the same project directory', async ({
  teardown,
  plan,
  is
}) => {
  plan(9)
  const helper = new Helper()
  teardown(() => helper.close(), { order: Infinity })
  await helper.ready()
  const dir = Helper.fixture('stage-app-min')
  const touching = helper.touch({ dir })
  const touched = await Helper.pick(touching, [{ tag: 'final' }])

  const result = await touched.final

  is(result.success, true)
  is(result.length, 0)
  is(result.fork, 0)
  is(result.link, 'pear://' + result.key)

  const touching2 = helper.touch({ dir })
  const touched2 = await Helper.pick(touching2, [{ tag: 'final' }])

  const result2 = await touched2.final

  is(result2.success, true)
  is(result2.length, result.length)
  is(result2.fork, result.fork)
  is(result2.link, result.link)
  is(result.key, result2.key)
})
