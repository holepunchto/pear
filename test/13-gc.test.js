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

  const target = await createDrive(t)
  await cacheDrive(t, helper, target.link)

  const collecting = helper.gc({ resource: 'cores', data: { link: target.link } })
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
  }, /A link must be specified/)
})

async function createDrive(t) {
  const store = new Corestore(await t.tmp())
  t.teardown(() => store.close())
  await store.ready()

  const drive = new Hyperdrive(store)
  await drive.ready()
  await drive.put('/index.js', Buffer.from('module.exports = true'))

  const swarm = new Hyperswarm({ bootstrap: Helper.dhtBootstrap })
  t.teardown(() => swarm.destroy())
  swarm.on('connection', (connection) => store.replicate(connection))
  const topic = swarm.join(drive.discoveryKey, { server: true, client: false })
  await topic.flushed()

  return {
    link: plink.serialize({ drive: { key: drive.key } }),
    content: plink.serialize({ drive: { key: drive.blobs.core.key } })
  }
}

async function cacheDrive(t, helper, link) {
  const dumping = helper.dump({ link, dir: await t.tmp() })
  t.teardown(() => Helper.teardownStream(dumping))
  const result = await Helper.pick(dumping, [{ tag: 'final' }])
  await result.final
}
