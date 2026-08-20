'use strict'
const test = require('brittle')
const Helper = require('./helper')

test('pear cores lists default cores', async ({ teardown, plan, is, ok }) => {
  plan(7)
  const helper = new Helper()
  teardown(() => helper.close(), { order: Infinity })
  await helper.ready()
  const coresStream = helper.cores()
  const cores = await Helper.pick(coresStream, [{ tag: 'core' }, { tag: 'final' }])

  const core = await cores.core
  ok(/^pear:\/\/[a-z0-9]{52}$/.test(core.link))
  is(typeof core.writable, 'boolean')
  is(typeof core.blobs, 'boolean')
  ok(Object.hasOwn(core, 'name'))

  const result = await cores.final

  is(result.success, true)
  ok(result.count > 0)
  ok(result.writable <= result.count)
})

test('pear cores names cores and groups blobs with their metadata core', async (t) => {
  t.plan(8)

  const helper = new Helper()
  t.teardown(() => helper.close(), { order: Infinity })
  await helper.ready()

  const name = 'cores-' + Helper.getRandomId().slice(0, 8)
  const target = await Helper.createDrive(t, { pkg: { name } })
  await Helper.cacheDrive(t, helper, target.link)

  const cores = await list(t, helper)
  const metadata = cores.find(({ link }) => link === target.link)
  const blobs = cores.find(({ link }) => link === target.content)

  t.ok(metadata, 'metadata core is listed')
  t.is(metadata.name, name, 'name comes from /package.json')
  t.is(metadata.blobs, false)
  t.is(metadata.drive, target.link, 'metadata core groups under itself')

  t.ok(blobs, 'blobs core is listed')
  t.is(blobs.name, name, 'blobs core takes the name of its drive')
  t.is(blobs.blobs, true)
  t.is(blobs.drive, target.link, 'blobs core groups under its metadata core')
})

test('pear cores reports a null name for a drive without package.json', async (t) => {
  t.plan(3)

  const helper = new Helper()
  t.teardown(() => helper.close(), { order: Infinity })
  await helper.ready()

  const target = await Helper.createDrive(t)
  await Helper.cacheDrive(t, helper, target.link)

  const cores = await list(t, helper)
  const metadata = cores.find(({ link }) => link === target.link)
  const blobs = cores.find(({ link }) => link === target.content)

  t.is(metadata.name, null)
  t.is(blobs.name, null)
  t.is(blobs.drive, target.link, 'unnamed drives still group')
})

async function list(t, helper, params = { allCores: true }) {
  const cores = []
  const stream = helper.cores(params)
  t.teardown(() => Helper.teardownStream(stream))
  stream.on('data', ({ tag, data }) => {
    if (tag === 'core') cores.push(data)
  })
  const listed = await Helper.pick(stream, [{ tag: 'final' }])
  await listed.final
  return cores
}
