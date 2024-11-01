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

  const versionsBuild = await build({ dir: versions, comment, teardown })
  const dhtBootstrapBuild = await build({ dir: dhtBootstrap, comment, teardown })
  ok(hypercoreid.isValid(versionsBuild.key), 'app key is valid')
  ok(hypercoreid.isValid(dhtBootstrapBuild.key), 'app key is valid')
  ok(versionsBuild.staged.success, 'stage succeeded')
  ok(dhtBootstrapBuild.staged.success, 'stage succeeded')
  ok(versionsBuild.announced, 'seeding is announced')
  ok(dhtBootstrapBuild.announced, 'seeding is announced')
  
  const versionsRun = await Helper.run({ link: versionsBuild.link })
  const dhtBootstrapRun = await Helper.run({ link: dhtBootstrapBuild.link })

  const versionsRes = await Helper.untilResult(versionsRun.pipe)
  is(JSON.parse(versionsRes).app.key, versionsBuild.key, 'app version matches staged key')
  const dhtBootstrapRes = await Helper.untilResult(dhtBootstrapRun.pipe)
  alike(JSON.parse(dhtBootstrapRes), Pear.config.dht.bootstrap, 'dht bootstrap matches Pear.config.dth.bootstrap')

  await Helper.untilClose(versionsRun.pipe)
  ok(true, 'ended')
  await Helper.untilClose(dhtBootstrapRun.pipe)
  ok(true, 'ended')
})

test('app with assets', async function ({ ok, is, plan, comment, teardown, timeout }) {
  timeout(180000)
  plan(2)

  const { link } = await build({ dir: requireAssets, comment, teardown })
  const { pipe } = await Helper.run({ link })

  const asset = await Helper.untilResult(pipe)
  is(asset.trim(), 'This is the content of the asset', 'Read asset from entrypoint')

  await Helper.untilClose(pipe)
  ok(true, 'ended')
})

test('app with assets in sub dep', async function ({ ok, is, plan, comment, teardown, timeout }) {
  timeout(180000)
  plan(2)

  const { link } = await build({ dir: subDepRequireAssets, comment, teardown })
  const { pipe } = await Helper.run({ link })

  const asset = await Helper.untilResult(pipe)
  is(asset.trim(), 'This is the content of the asset', 'Read asset from entrypoint')

  await Helper.untilClose(pipe)
  ok(true, 'ended')
})

async function build ({ dir, comment = console.log, teardown = () => undefined }) {
  const helper = new Helper()
  teardown(() => helper.close(), { order: Infinity })
  await helper.ready()

  const id = Math.floor(Math.random() * 10000)

  comment('staging')
  const staging = helper.stage({ channel: `test-${id}`, name: `test-${id}`, dir, dryRun: false, bare: true })
  teardown(() => Helper.teardownStream(staging))
  const staged = await Helper.pick(staging, { tag: 'final' })

  comment('seeding')
  const seeding = helper.seed({ channel: `test-${id}`, name: `test-${id}`, dir, key: null, cmdArgs: [] })
  teardown(() => Helper.teardownStream(seeding))
  const until = await Helper.pick(seeding, [{ tag: 'key' }, { tag: 'announced' }])
  const announced = await until.announced
  const key = await until.key
  const link = `pear://${key}`

  return { helper, key, link, staged, announced }
}