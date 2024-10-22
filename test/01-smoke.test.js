'use strict'
const test = require('brittle')
const path = require('bare-path')
const hypercoreid = require('hypercore-id-encoding')
const Helper = require('./helper')
const harness = path.join(Helper.localDir, 'test', 'fixtures', 'harness')
const assets = path.join(Helper.localDir, 'test', 'fixtures', 'app-with-assets')

test('smoke', async function ({ ok, is, plan, comment, teardown, timeout, end }) {
  timeout(180000)
  plan(6)
  const stager = new Helper()
  teardown(() => stager.close(), { order: Infinity })
  await stager.ready()
  const dir = harness

  const id = Math.floor(Math.random() * 10000)

  comment('staging')
  const staging = stager.stage({ channel: `test-${id}`, name: `test-${id}`, dir, dryRun: false, bare: true })
  teardown(() => Helper.teardownStream(staging))
  const final = await Helper.pick(staging, { tag: 'final' })
  ok(final.success, 'stage succeeded')

  comment('seeding')
  const seeder = new Helper()
  teardown(() => seeder.close(), { order: Infinity })
  await seeder.ready()
  const seeding = seeder.seed({ channel: `test-${id}`, name: `test-${id}`, dir, key: null, cmdArgs: [] })
  teardown(() => Helper.teardownStream(seeding))
  const until = await Helper.pick(seeding, [{ tag: 'key' }, { tag: 'announced' }])

  const key = await until.key
  const announced = await until.announced

  ok(hypercoreid.isValid(key), 'app key is valid')
  ok(announced, 'seeding is announced')

  comment('running')
  const link = 'pear://' + key
  const running = await Helper.open(link, { tags: ['exit'] })

  const { value } = await running.inspector.evaluate('Pear.versions()', { awaitPromise: true })
  is(value?.app?.key, key, 'app version matches staged key')

  const dhtBootstrap = await running.inspector.evaluate('Pear.config.dht.bootstrap')
  is(JSON.stringify(dhtBootstrap.value), JSON.stringify(Pear.config.dht.bootstrap), 'dht bootstrap matches Pear.config.dth.bootstrap')

  await running.inspector.close()
  const { code } = await running.until.exit
  is(code, 0, 'exit code is 0')
})

test('app with assets', async function ({ is, plan, comment, teardown, timeout }) {
  timeout(180000)
  plan(3)
  const stager = new Helper()
  teardown(() => stager.close(), { order: Infinity })
  await stager.ready()
  const dir = assets

  const id = Math.floor(Math.random() * 10000)

  comment('staging')
  const staging = stager.stage({ channel: `test-${id}`, name: `test-${id}`, dir, dryRun: false, bare: true })
  teardown(() => Helper.teardownStream(staging))
  await Helper.pick(staging, { tag: 'final' })

  comment('seeding')
  const seeder = new Helper()
  teardown(() => seeder.close(), { order: Infinity })
  await seeder.ready()
  const seeding = seeder.seed({ channel: `test-${id}`, name: `test-${id}`, dir, key: null, cmdArgs: [] })
  teardown(() => Helper.teardownStream(seeding))
  const until = await Helper.pick(seeding, [{ tag: 'key' }, { tag: 'announced' }])

  const key = await until.key
  await until.announced

  comment('running')
  const link = 'pear://' + key
  const running = await Helper.open(link, { tags: ['exit'] })

  const { value: fromIndex } = await running.inspector.evaluate('global.readAsset()', { awaitPromise: true })
  is(fromIndex.trim(), 'This is the content of the asset', 'Read asset from entrypoint')

  const { value: fromUtils } = await running.inspector.evaluate('global.readAssetFromUtils()', { awaitPromise: true })
  is(fromUtils.trim(), 'This is the content of the asset', 'Read asset from lib')

  await running.inspector.evaluate('disableInspector()')
  await running.inspector.close()
  const { code } = await running.until.exit
  is(code, 0, 'exit code is 0')
})
