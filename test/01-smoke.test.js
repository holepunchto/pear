'use strict'
const test = require('brittle')
const path = require('bare-path')
const hypercoreid = require('hypercore-id-encoding')
const Helper = require('./helper')
const versions = path.join(Helper.localDir, 'test', 'fixtures', 'versions')
const dhtBootstrap = path.join(Helper.localDir, 'test', 'fixtures', 'dht-bootstrap')
const requireAssets = path.join(Helper.localDir, 'test', 'fixtures', 'require-assets')
const subDepRequireAssets = path.join(Helper.localDir, 'test', 'fixtures', 'sub-dep-require-assets')

test.solo('smoke', async function ({ ok, is, alike, plan, comment, teardown, timeout }) {
  timeout(180000)
  plan(10)

  const versionsHelper = new Helper()
  const dhtBootstrapHelper = new Helper()

  const versionsBuild = await versionsHelper.build({ dir: versions, comment, teardown })
  const dhtBootstrapBuild = await dhtBootstrapHelper.build({ dir: dhtBootstrap, comment, teardown })
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

  const helper = new Helper()
  const { link } = await helper.build({ dir: requireAssets, comment, teardown })
  const { pipe } = await Helper.run({ link })

  const asset = await Helper.untilResult(pipe)
  is(asset.trim(), 'This is the content of the asset', 'Read asset from entrypoint')

  await Helper.untilClose(pipe)
  ok(true, 'ended')
})

test('app with assets in sub dep', async function ({ ok, is, plan, comment, teardown, timeout }) {
  timeout(180000)
  plan(2)

  const helper = new Helper()
  const { link } = await helper.build({ dir: subDepRequireAssets, comment, teardown })
  const { pipe } = await Helper.run({ link })

  const asset = await Helper.untilResult(pipe)
  is(asset.trim(), 'This is the content of the asset', 'Read asset from entrypoint')

  await Helper.untilClose(pipe)
  ok(true, 'ended')
})
