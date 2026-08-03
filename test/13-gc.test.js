'use strict'
const test = require('brittle')
const Corestore = require('corestore')
const Hyperdrive = require('hyperdrive')
const Hyperswarm = require('hyperswarm')
const hypercoreid = require('hypercore-id-encoding')
const plink = require('pear-link')
const Helper = require('./helper')

test('pear gc cores with link', async (t) => {
  t.plan(6)

  const helper = new Helper()
  t.teardown(() => helper.close(), { order: Infinity })
  await helper.ready()

  const target = await createDrive(t)
  const other = await createDrive(t)
  await cacheDrive(t, helper, target.link)
  await cacheDrive(t, helper, other.link)

  const removed = []
  const collecting = helper.gc({ resource: 'cores', data: { link: target.link } })
  t.teardown(() => Helper.teardownStream(collecting))
  collecting.on('data', ({ tag, data }) => {
    if (tag === 'remove') removed.push(data)
  })

  const result = await Helper.pick(collecting, [{ tag: 'final' }])
  const final = await result.final

  t.is(final.success, true)
  t.is(final.count, 2)
  t.is(removed.length, 2)
  t.alike(removed.map(({ id }) => id).sort(), target.ids.sort())
  t.alike(
    removed.map(({ link }) => link),
    [target.link, target.link]
  )

  const links = []
  const cores = helper.cores()
  t.teardown(() => Helper.teardownStream(cores))
  cores.on('data', ({ tag, data }) => {
    if (tag === 'core') links.push(data.link)
  })
  const listed = await Helper.pick(cores, [{ tag: 'final' }])
  await listed.final

  t.ok(
    target.coreLinks.every((link) => !links.includes(link)),
    'gc cores are not listed'
  )
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
    ids: [
      hypercoreid.encode(drive.core.discoveryKey),
      hypercoreid.encode(drive.blobs.core.discoveryKey)
    ],
    coreLinks: [drive.core.key, drive.blobs.core.key].map((key) =>
      plink.serialize({ drive: { key } })
    )
  }
}

async function cacheDrive(t, helper, link) {
  const dumping = helper.dump({ link, dir: await t.tmp() })
  t.teardown(() => Helper.teardownStream(dumping))
  const result = await Helper.pick(dumping, [{ tag: 'final' }])
  await result.final
}
