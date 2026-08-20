'use strict'
const test = require('brittle')
const Corestore = require('corestore')
const Hyperdrive = require('hyperdrive')
const Hyperswarm = require('hyperswarm')
const plink = require('pear-link')
const Helper = require('./helper')

test('pear gc cores with link', async (t) => {
  t.plan(3)

  const helper = new Helper()
  t.teardown(() => helper.close(), { order: Infinity })
  await helper.ready()

  const target = await Helper.createDrive(t)
  await Helper.cacheDrive(t, helper, target.link)

  const collecting = helper.gc({ resource: 'cores', data: { links: [target.link] } })
  t.teardown(() => Helper.teardownStream(collecting))

  const result = await Helper.pick(collecting, [{ tag: 'final' }])
  const final = await result.final
  t.is(final.success, true)

  const links = []
  const cores = helper.cores()
  t.teardown(() => Helper.teardownStream(cores))
  cores.on('data', ({ tag, data }) => {
    if (tag === 'core') links.push(data.link)
  })
  const listed = await Helper.pick(cores, [{ tag: 'final' }])
  await listed.final

  t.ok(!links.includes(target.link), 'gc cores are not listed')
  t.ok(!links.includes(target.content), 'gc cores are not listed')
})

test('pear gc cores without link', async (t) => {
  t.plan(1)

  const helper = new Helper()
  t.teardown(() => helper.close(), { order: Infinity })
  await helper.ready()

  const collecting = helper.gc({ resource: 'cores', data: {} })
  t.teardown(() => Helper.teardownStream(collecting))

  await t.exception(async () => {
    const result = await Helper.pick(collecting, [{ tag: 'final' }])
    await result.final
  }, /At least a link must be specified/)
})

test('pear gc cores with empty links', async (t) => {
  t.plan(1)

  const helper = new Helper()
  t.teardown(() => helper.close(), { order: Infinity })
  await helper.ready()

  const collecting = helper.gc({ resource: 'cores', data: { links: [] } })
  t.teardown(() => Helper.teardownStream(collecting))

  await t.exception(async () => {
    const result = await Helper.pick(collecting, [{ tag: 'final' }])
    await result.final
  }, /At least a link must be specified/)
})
