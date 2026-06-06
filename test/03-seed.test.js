'use strict'
const test = require('brittle')
const Corestore = require('corestore')
const Hyperdrive = require('hyperdrive')
const Hyperswarm = require('hyperswarm')
const hypercoreid = require('hypercore-id-encoding')
const Localdrive = require('localdrive')
const Helper = require('./helper')

test('pear seed basic stage and seed', async function ({ ok, plan, comment, teardown, timeout }) {
  timeout(180000)
  plan(3)

  const dir = Helper.fixture('versions')

  const helper = new Helper()
  teardown(() => helper.close(), { order: Infinity })
  await helper.ready()
  const link = await Helper.touchLink(helper)

  comment('staging')
  const staging = helper.stage({
    link,
    dir,
    dryRun: false
  })
  teardown(() => Helper.teardownStream(staging))
  const staged = await Helper.pick(staging, { tag: 'final' })
  ok(staged.success, 'stage succeeded')

  comment('seeding')
  const seeding = helper.seed({
    link,
    dir,
    key: null,
    cmdArgs: []
  })
  teardown(() => Helper.teardownStream(seeding))
  const until = await Helper.pick(seeding, [{ tag: 'key' }, { tag: 'announced' }])
  const announced = await until.announced
  ok(announced, 'seeding is announced')

  const key = await until.key
  ok(hypercoreid.isValid(key), 'app key is valid')
})

test('pear seed announces, join, drop', async function ({
  ok,
  plan,
  comment,
  teardown,
  timeout,
  tmp
}) {
  timeout(180000)
  plan(3)

  const dir = Helper.fixture('minimal')
  const helper = new Helper()
  teardown(() => helper.close(), { order: Infinity })
  await helper.ready()
  const link = await Helper.touchLink(helper)

  comment('staging')
  const staging = helper.stage({
    link,
    dir,
    dryRun: false
  })
  teardown(() => Helper.teardownStream(staging))
  await Helper.pick(staging, { tag: 'final' })

  comment('seeding')
  const seeding = helper.seed({
    link,
    dir,
    key: null,
    cmdArgs: []
  })
  teardown(() => Helper.teardownStream(seeding))
  const until = await Helper.pick(seeding, [
    { tag: 'key' },
    { tag: 'announced' },
    { tag: 'peer-add' },
    { tag: 'peer-remove' }
  ])
  const announced = await until.announced
  ok(announced, 'seeding is announced')
  const key = await until.key

  const peerStore = new Corestore(await tmp())
  teardown(() => peerStore.close())
  await peerStore.ready()
  const peerDrive = new Hyperdrive(peerStore, key)
  await peerDrive.ready()

  const peerSwarm = new Hyperswarm({ bootstrap: Helper.dhtBootstrap })
  teardown(() => peerSwarm.destroy())
  peerSwarm.on('connection', (conn) => {
    peerDrive.corestore.replicate(conn)
  })
  peerSwarm.join(peerDrive.discoveryKey)
  await peerDrive.get('/package.json')

  const joined = await until['peer-add']
  ok(joined, 'peer joins')

  await peerSwarm.destroy()

  const dropped = await until['peer-remove']
  ok(dropped, 'peer drops')
})

test('pear seed fully syncs db and blobs cores', async function ({
  is,
  plan,
  comment,
  teardown,
  timeout,
  tmp
}) {
  timeout(180000)
  plan(2)

  const sourceStore = new Corestore(await tmp())
  teardown(() => sourceStore.close())
  await sourceStore.ready()
  const sourceDrive = new Hyperdrive(sourceStore)
  await sourceDrive.ready()
  await new Localdrive(Helper.fixture('minimal')).mirror(sourceDrive).done()
  const sourceBlobs = await sourceDrive.getBlobs()
  const blocks = sourceDrive.db.core.length + sourceBlobs.core.length

  let dbBlocks = 0
  sourceDrive.db.core.on('upload', () => dbBlocks++)

  let blobBlocks = 0
  sourceBlobs.core.on('upload', () => blobBlocks++)

  const sourceSwarm = new Hyperswarm({ bootstrap: Helper.dhtBootstrap })
  teardown(() => sourceSwarm.destroy())
  sourceSwarm.on('connection', (conn) => {
    sourceStore.replicate(conn)
  })
  const topic = sourceSwarm.join(sourceDrive.discoveryKey, { server: true, client: false })
  await topic.flushed()

  const helper = new Helper()
  teardown(() => helper.close(), { order: Infinity })
  await helper.ready()

  comment('seeding external app')
  const link = `pear://${hypercoreid.encode(sourceDrive.key)}`
  const seeding = helper.seed({ link })
  teardown(() => Helper.teardownStream(seeding))
  await Helper.pick(seeding, { tag: 'stats', data: { download: { totalBlocks: blocks } } })

  is(dbBlocks, sourceDrive.db.core.length, 'seed synced db core')
  is(blobBlocks, sourceBlobs.core.length, 'seed synced blobs core')
})
