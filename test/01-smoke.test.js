'use strict'
const test = require('brittle')
const path = require('bare-path')
const hypercoreid = require('hypercore-id-encoding')
const Helper = require('./helper')
const versions = path.join(Helper.localDir, 'test', 'fixtures', 'versions')
const dhtBootstrap = path.join(Helper.localDir, 'test', 'fixtures', 'dht-bootstrap')
const requireAssets = path.join(Helper.localDir, 'test', 'fixtures', 'require-assets')
const subDepRequireAssets = path.join(Helper.localDir, 'test', 'fixtures', 'sub-dep-require-assets')

test('smoke', async function ({ ok, is, alike, plan, comment, teardown, timeout }) {
  timeout(180000)
  plan(10)

  const versionsRun = await run({ dir: versions, ok, comment, teardown })
  is(JSON.parse(versionsRun.result).app.key, versionsRun.key, 'app version matches staged key')

  const dhtBootstrapRun = await run({ dir: dhtBootstrap, ok, comment, teardown })
  alike(JSON.parse(dhtBootstrapRun.result), Pear.config.dht.bootstrap, 'dht bootstrap matches Pear.config.dth.bootstrap')

  await Helper.untilClose(versionsRun.pipe)
  ok(true, 'ended')

  await Helper.untilClose(dhtBootstrapRun.pipe)
  ok(true, 'ended')
})

test('app with assets', async function ({ ok, is, plan, comment, teardown, timeout }) {
  timeout(180000)
  plan(5)

  const { pipe, result } = await run({ dir: requireAssets, ok, comment, teardown })
  is(result.trim(), 'This is the content of the asset', 'Read asset from entrypoint')

  await Helper.untilClose(pipe)
  ok(true, 'ended')
})

test('app with assets in sub dep', async function ({ ok, is, plan, comment, teardown, timeout }) {
  timeout(180000)
  plan(5)

  const { pipe, result } = await run({ dir: subDepRequireAssets, ok, comment, teardown })
  is(result.trim(), 'This is the content of the asset', 'Read asset from entrypoint')

  await Helper.untilClose(pipe)
  ok(true, 'ended')
})

async function run ({ dir, ok, comment, teardown }) {
  const { key, link } = await build({ dir, ok, comment, teardown })
  const { pipe } = await Helper.run({ link })
  const result = await Helper.untilResult(pipe)
  return { key, pipe, result }
}

async function build ({ dir, ok, comment, teardown }) {
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

  return { key, link }
}
