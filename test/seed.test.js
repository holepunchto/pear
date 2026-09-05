'use strict'
const test = require('brittle')
const Corestore = require('corestore')
const Hyperdrive = require('hyperdrive')
const Hyperswarm = require('hyperswarm')
const hypercoreid = require('hypercore-id-encoding')
const Helper = require('./helper')

test('pear seed basic stage and seed', async function ({
  ok,
  is,
  plan,
  comment,
  teardown,
  timeout
}) {
  timeout(180000)
  plan(18)

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
  const staged = await Helper.pick(staging, [{ tag: 'addendum' }, { tag: 'final' }])
  const addendum = await staged.addendum
  const final = await staged.final
  ok(final.success, 'stage succeeded')

  comment('seeding')
  const seeding = helper.seed({
    link,
    dir,
    key: null,
    cmdArgs: []
  })
  teardown(() => Helper.teardownStream(seeding))
  const until = await Helper.pick(seeding, [{ tag: 'key' }, { tag: 'announced' }, { tag: 'stats' }])
  const announced = await until.announced
  ok(announced, 'seeding is announced')

  const key = await until.key
  ok(hypercoreid.isValid(key), 'app key is valid')

  const stats = await until.stats
  is(stats.driveKey, hypercoreid.normalize(stats.driveKey), 'stats driveKey is z32')
  is(stats.driveLength, addendum.version, 'stats have driveLength')
  ok(Number.isInteger(stats.blobsByteLength), 'stats have blobsByteLength')
  is(stats.name, 'versions', 'stats have package name')
  is(stats.semver, '', 'stats have without semver')
  is(stats.discoveryKey, hypercoreid.normalize(stats.discoveryKey), 'stats discoveryKey is z32')
  is(stats.contentKey, hypercoreid.normalize(stats.contentKey), 'stats contentKey is z32')
  is(stats.whoami, hypercoreid.normalize(stats.whoami), 'stats whoami is z32')
  ok(Number.isInteger(stats.peers), 'stats have peers')
  ok(Number.isFinite(stats.upload.speed), 'stats have upload.speed')
  ok(Number.isInteger(stats.upload.totalBytes), 'stats have upload.totalBytes')
  ok(Number.isInteger(stats.upload.totalBlocks), 'stats have upload.totalBlocks')
  ok(Number.isFinite(stats.download.speed), 'stats have download.speed')
  ok(Number.isInteger(stats.download.totalBytes), 'stats have download.totalBytes')
  ok(Number.isInteger(stats.download.totalBlocks), 'stats have download.totalBlocks')
})

test('pear seed announces, join, drop', async function ({
  ok,
  is,
  plan,
  comment,
  teardown,
  timeout,
  tmp
}) {
  timeout(180000)
  plan(5)

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
    { tag: 'stats', data: { name: 'minimal', semver: '1.0.0' } },
    { tag: 'peer-add' },
    { tag: 'peer-remove' }
  ])
  const announced = await until.announced
  ok(announced, 'seeding is announced')
  const key = await until.key
  const stats = await until.stats
  is(stats.name, 'minimal', 'stats have name')
  is(stats.semver, '1.0.0', 'stats have semver')

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
  is(joined, hypercoreid.normalize(joined), 'peer join key is z32')

  await peerSwarm.destroy()

  const dropped = await until['peer-remove']
  is(dropped, hypercoreid.normalize(dropped), 'peer drop key is z32')
})

test('pear seed empty drive has pending content key', async function ({ is, plan, teardown }) {
  plan(6)

  const helper = new Helper()
  teardown(() => helper.close(), { order: Infinity })
  await helper.ready()
  const link = await Helper.touchLink(helper)

  const seeding = helper.seed({ link })
  teardown(() => Helper.teardownStream(seeding))
  const stats = await Helper.pick(seeding, { tag: 'stats', data: { contentKey: 'pending' } })

  is(stats.contentKey, 'pending', 'content key is pending')
  is(stats.blobsSynced, 0, 'blobs synced is zero')
  is(stats.blobsLength, 0, 'blobs length is zero')
  is(stats.blobsByteLength, 0, 'blobs byteLength is zero')
  is(stats.name, '', 'name is empty')
  is(stats.semver, '', 'semver is empty')
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
  plan(3)

  const sourceStore = new Corestore(await tmp())
  teardown(() => sourceStore.close())
  await sourceStore.ready()
  const sourceDrive = new Hyperdrive(sourceStore)
  await sourceDrive.ready()
  await sourceDrive.put('/index.js', 'module.exports = {}\n')
  await sourceDrive.put('/test.txt', 'test')
  const sourceBlobs = await sourceDrive.getBlobs()

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

  comment('seeding source drive')
  const link = `pear://${hypercoreid.encode(sourceDrive.key)}`
  const seeding = helper.seed({ link })
  teardown(() => Helper.teardownStream(seeding))
  const totalBlocks = sourceDrive.db.core.length + sourceBlobs.core.length
  const stats = await Helper.pick(seeding, {
    tag: 'stats',
    data: {
      download: { totalBlocks },
      driveSynced: sourceDrive.db.core.length,
      blobsSynced: sourceBlobs.core.length,
      blobsLength: sourceBlobs.core.length
    }
  })

  is(stats.blobsByteLength, sourceBlobs.core.byteLength, 'blobs size matches')
  is(dbBlocks, sourceDrive.db.core.length, 'synced db core')
  is(blobBlocks, sourceBlobs.core.length, 'synced blobs core')
})

test('pear seed --until-sync one specific peer', async function ({
  ok,
  plan,
  teardown,
  timeout,
  tmp
}) {
  timeout(180000)
  plan(2)

  const helper = new Helper()
  teardown(() => helper.close(), { order: Infinity })
  await helper.ready()
  const link = await Helper.touchLink(helper)

  const staging = helper.stage({ link, dir: Helper.fixture('minimal'), dryRun: false })
  teardown(() => Helper.teardownStream(staging))
  await Helper.pick(staging, { tag: 'final' })

  const peerStore = new Corestore(await tmp())
  teardown(() => peerStore.close())
  await peerStore.ready()
  const peerDrive = new Hyperdrive(peerStore, hypercoreid.decode(link))
  await peerDrive.ready()

  const peerSwarm = new Hyperswarm({ bootstrap: Helper.dhtBootstrap })
  teardown(() => peerSwarm.destroy())
  peerSwarm.on('connection', (conn) => peerStore.replicate(conn))
  peerSwarm.join(peerDrive.discoveryKey)
  await peerSwarm.flush()

  const seeding = helper.seed({
    link,
    untilSync: [hypercoreid.encode(peerSwarm.keyPair.publicKey)]
  })
  teardown(() => Helper.teardownStream(seeding))
  const until = await Helper.pick(seeding, [{ tag: 'peer-sync' }, { tag: 'final' }])

  await peerDrive.db.core.update()
  await peerDrive.db.core.download({ start: 0, end: peerDrive.db.core.length }).done()
  await peerDrive.download().done()
  await peerDrive.blobs.core.download({ start: 0, end: peerDrive.blobs.core.length }).done()

  ok(await until['peer-sync'], 'selected peer syncs')
  const seeded = await until.final
  ok(seeded.success, 'seed exited after specific peer fully synced')
})

test('pear seed --until-sync two specific peers', async function ({
  is,
  ok,
  plan,
  teardown,
  timeout,
  tmp
}) {
  timeout(180000)
  plan(2)

  const helper = new Helper()
  teardown(() => helper.close(), { order: Infinity })
  await helper.ready()
  const link = await Helper.touchLink(helper)

  const staging = helper.stage({ link, dir: Helper.fixture('minimal'), dryRun: false })
  teardown(() => Helper.teardownStream(staging))
  await Helper.pick(staging, { tag: 'final' })

  const firstStore = new Corestore(await tmp())
  teardown(() => firstStore.close())
  await firstStore.ready()
  const firstDrive = new Hyperdrive(firstStore, hypercoreid.decode(link))
  await firstDrive.ready()

  const firstSwarm = new Hyperswarm({ bootstrap: Helper.dhtBootstrap })
  teardown(() => firstSwarm.destroy())
  firstSwarm.on('connection', (conn) => firstStore.replicate(conn))
  firstSwarm.join(firstDrive.discoveryKey)
  await firstSwarm.flush()

  const secondStore = new Corestore(await tmp())
  teardown(() => secondStore.close())
  await secondStore.ready()
  const secondDrive = new Hyperdrive(secondStore, hypercoreid.decode(link))
  await secondDrive.ready()

  const secondSwarm = new Hyperswarm({ bootstrap: Helper.dhtBootstrap })
  teardown(() => secondSwarm.destroy())
  secondSwarm.on('connection', (conn) => secondStore.replicate(conn))
  secondSwarm.join(secondDrive.discoveryKey)
  await secondSwarm.flush()

  const seeding = helper.seed({
    link,
    untilSync: [
      hypercoreid.encode(firstSwarm.keyPair.publicKey),
      hypercoreid.encode(secondSwarm.keyPair.publicKey)
    ]
  })
  teardown(() => Helper.teardownStream(seeding))
  const final = Helper.pick(seeding, { tag: 'final' })

  await firstDrive.db.core.update()
  await firstDrive.db.core.download({ start: 0, end: firstDrive.db.core.length }).done()
  await firstDrive.download().done()
  await firstDrive.blobs.core.download({ start: 0, end: firstDrive.blobs.core.length }).done()

  const pending = await Promise.race([
    final.then(() => false),
    new Promise((resolve) => setTimeout(() => resolve(true), 100))
  ])
  is(pending, true, 'seeding waits for the second selected peer')

  await secondDrive.db.core.update()
  await secondDrive.db.core.download({ start: 0, end: secondDrive.db.core.length }).done()
  await secondDrive.download().done()
  await secondDrive.blobs.core.download({ start: 0, end: secondDrive.blobs.core.length }).done()

  const seeded = await final
  ok(seeded.success, 'seed exited after two specific peers fully synced')
})
