'use strict'
const test = require('brittle')
const path = require('bare-path')
const hypercoreid = require('hypercore-id-encoding')
const Helper = require('./helper')
const versionsDir = path.join(Helper.localDir, 'test', 'fixtures', 'versions')
const dhtBootstrapDir = path.join(Helper.localDir, 'test', 'fixtures', 'dht-bootstrap')
const storageDir = path.join(Helper.localDir, 'test', 'fixtures', 'storage')
const requireAssets = path.join(Helper.localDir, 'test', 'fixtures', 'require-assets')
const subDepRequireAssets = path.join(Helper.localDir, 'test', 'fixtures', 'sub-dep-require-assets')

test('smoke', async function ({ ok, is, alike, plan, comment, teardown, timeout }) {
  timeout(180000)
  plan(13)

  const testVersions = async () => {
    const dir = versionsDir

    const helper = new Helper()
    teardown(() => helper.close(), { order: Infinity })
    await helper.ready()

    const id = Math.floor(Math.random() * 10000)

    comment('staging')
    const staging = helper.stage({ channel: `test-${id}`, name: `test-${id}`, dir, dryRun: false, bare: true })
    teardown(() => Helper.teardownStream(staging))
    const staged = await Helper.pick(staging, { tag: 'final' })
    ok(staged.success, 'stage succeeded')

    comment('seeding')
    const seeding = helper.seed({ channel: `test-${id}`, name: `test-${id}`, dir, key: null, cmdArgs: [] })
    teardown(() => Helper.teardownStream(seeding))
    const until = await Helper.pick(seeding, [{ tag: 'key' }, { tag: 'announced' }])
    const announced = await until.announced
    ok(announced, 'seeding is announced')

    const key = await until.key
    ok(hypercoreid.isValid(key), 'app key is valid')

    const link = `pear://${key}`
    const run = await Helper.run({ link })

    const result = await Helper.untilResult(run.pipe)
    const versions = JSON.parse(result)
    is(versions.app.key, key, 'app version matches staged key')

    await Helper.untilClose(run.pipe)
    ok(true, 'ended')
  }

  const testDhtBootstrap = async () => {
    const dir = dhtBootstrapDir

    const helper = new Helper()
    teardown(() => helper.close(), { order: Infinity })
    await helper.ready()

    const id = Math.floor(Math.random() * 10000)

    comment('staging')
    const staging = helper.stage({ channel: `test-${id}`, name: `test-${id}`, dir, dryRun: false, bare: true })
    teardown(() => Helper.teardownStream(staging))
    const staged = await Helper.pick(staging, { tag: 'final' })
    ok(staged.success, 'stage succeeded')

    comment('seeding')
    const seeding = helper.seed({ channel: `test-${id}`, name: `test-${id}`, dir, key: null, cmdArgs: [] })
    teardown(() => Helper.teardownStream(seeding))
    const until = await Helper.pick(seeding, [{ tag: 'key' }, { tag: 'announced' }])
    const announced = await until.announced
    ok(announced, 'seeding is announced')

    const key = await until.key
    ok(hypercoreid.isValid(key), 'app key is valid')

    const link = `pear://${key}`
    const run = await Helper.run({ link })

    const result = await Helper.untilResult(run.pipe)
    const dhtBootstrap = JSON.parse(result)
    alike(dhtBootstrap, Pear.config.dht.bootstrap, 'dht bootstrap matches Pear.config.dht.bootstrap')

    await Helper.untilClose(run.pipe)
    ok(true, 'ended')
  }

  const testStorage = async () => {
    const dir = storageDir

    const testAppStorage = Pear.config.storage
    ok(testAppStorage.includes('by-random'))

    const helper = new Helper()
    teardown(() => helper.close(), { order: Infinity })
    await helper.ready()

    const id = Math.floor(Math.random() * 10000)

    comment('staging')
    const staging = helper.stage({ channel: `test-${id}`, name: `test-${id}`, dir, dryRun: false, bare: true })
    teardown(() => Helper.teardownStream(staging))
    const staged = await Helper.pick(staging, [{ tag: 'addendum' }, { tag: 'final' }])
    const { key } = await staged.addendum
    await staged.final

    const link = `pear://${key}`
    const run = await Helper.run({ link })

    const result = await Helper.untilResult(run.pipe)
    const appStorage = result
    ok(appStorage.includes('by-dkey'))

    await Helper.untilClose(run.pipe)
    ok(true, 'ended')
  }

  await Promise.all([testVersions(), testDhtBootstrap(), testStorage()])
})

test('app with assets', async function ({ ok, is, plan, comment, teardown, timeout }) {
  timeout(180000)
  plan(5)

  const dir = requireAssets

  const helper = new Helper()
  teardown(() => helper.close(), { order: Infinity })
  await helper.ready()

  const id = Math.floor(Math.random() * 10000)

  comment('staging')
  const staging = helper.stage({ channel: `test-${id}`, name: `test-${id}`, dir, dryRun: false, bare: true })
  teardown(() => Helper.teardownStream(staging))
  const staged = await Helper.pick(staging, { tag: 'final' })
  ok(staged.success, 'stage succeeded')

  comment('seeding')
  const seeding = helper.seed({ channel: `test-${id}`, name: `test-${id}`, dir, key: null, cmdArgs: [] })
  teardown(() => Helper.teardownStream(seeding))
  const until = await Helper.pick(seeding, [{ tag: 'key' }, { tag: 'announced' }])
  const announced = await until.announced
  ok(announced, 'seeding is announced')

  const key = await until.key
  ok(hypercoreid.isValid(key), 'app key is valid')

  const link = `pear://${key}`
  const run = await Helper.run({ link })

  const result = await Helper.untilResult(run.pipe)
  is(result.trim(), 'This is the content of the asset', 'Read asset from entrypoint')

  await Helper.untilClose(run.pipe)
  ok(true, 'ended')
})

test('app with assets in sub dep', async function ({ ok, is, plan, comment, teardown, timeout }) {
  timeout(180000)
  plan(5)

  const dir = subDepRequireAssets

  const helper = new Helper()
  teardown(() => helper.close(), { order: Infinity })
  await helper.ready()

  const id = Math.floor(Math.random() * 10000)

  comment('staging')
  const staging = helper.stage({ channel: `test-${id}`, name: `test-${id}`, dir, dryRun: false, bare: true })
  teardown(() => Helper.teardownStream(staging))
  const staged = await Helper.pick(staging, { tag: 'final' })
  ok(staged.success, 'stage succeeded')

  comment('seeding')
  const seeding = helper.seed({ channel: `test-${id}`, name: `test-${id}`, dir, key: null, cmdArgs: [] })
  teardown(() => Helper.teardownStream(seeding))
  const until = await Helper.pick(seeding, [{ tag: 'key' }, { tag: 'announced' }])
  const announced = await until.announced
  ok(announced, 'seeding is announced')

  const key = await until.key
  ok(hypercoreid.isValid(key), 'app key is valid')

  const link = `pear://${key}`
  const run = await Helper.run({ link })

  const result = await Helper.untilResult(run.pipe)
  is(result.trim(), 'This is the content of the asset', 'Read asset from entrypoint')

  await Helper.untilClose(run.pipe)
  ok(true, 'ended')
})
