'use strict'
const test = require('brittle')
const Helper = require('./helper')

test('pear touch generates clean pear link', async ({ teardown, plan, not, is }) => {
  plan(12)
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
  is(result.verlink, 'pear://' + result.fork + '.' + result.length + '.' + result.key)

  const touching2 = helper.touch()
  const touched2 = await Helper.pick(touching2, [{ tag: 'final' }])

  const result2 = await touched2.final

  is(result2.success, true)
  is(result2.length, 0)
  is(result2.fork, 0)
  is(result2.link, 'pear://' + result2.key)
  is(result2.verlink, 'pear://' + result2.fork + '.' + result2.length + '.' + result2.key)
  not(result.channel, result2.channel)
  not(result.key, result2.key)
})

test('pear touch <channel> creates pear link if nonexistent or responds with existing pear link', async ({
  teardown,
  plan,
  is
}) => {
  plan(12)
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
  is(result.verlink, 'pear://' + result.fork + '.' + result.length + '.' + result.key)

  const touching2 = helper.touch({ channel: result.channel })
  const touched2 = await Helper.pick(touching2, [{ tag: 'final' }])

  const result2 = await touched2.final

  is(result2.success, true)
  is(result2.length, result.length)
  is(result2.fork, result.fork)
  is(result2.link, 'pear://' + result2.key)
  is(result2.verlink, 'pear://' + result2.fork + '.' + result2.length + '.' + result2.key)
  is(result.channel, result2.channel)
  is(result.key, result2.key)
})
