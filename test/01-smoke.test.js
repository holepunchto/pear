'use strict'
const test = require('brittle')
const path = require('bare-path')
const hypercoreid = require('hypercore-id-encoding')
const Helper = require('./helper')
const basic = path.join(Helper.localDir, 'test', 'fixtures', 'basic')
const requireAssets = path.join(Helper.localDir, 'test', 'fixtures', 'require-assets')

test('smoke', async function ({ ok, is, plan, comment, teardown, timeout }) {
  timeout(180000)
  plan(6)

  const helper = new Helper()
  const { pipe, key, staged, announced } = await helper.__open({ dir: basic, comment, teardown })
  ok(hypercoreid.isValid(key), 'app key is valid')
  ok(staged.success, 'stage succeeded')
  ok(announced, 'seeding is announced')

  const versions = await Helper.send(pipe, 'versions')
  is(versions.app.key, key, 'app version matches staged key')

  const dhtBootstrap = await Helper.send(pipe, 'dhtBootstrap')
  is(JSON.stringify(dhtBootstrap), JSON.stringify(Pear.config.dht.bootstrap), 'dht bootstrap matches Pear.config.dth.bootstrap')

  await Helper.end(pipe)
  ok(true, 'ended')
})

test('app with assets', async function ({ ok, is, plan, comment, teardown, timeout }) {
  timeout(180000)
  plan(3)

  const helper = new Helper()
  const { pipe } = await helper.__open({ dir: requireAssets, comment, teardown })

  const asset = await Helper.send(pipe, 'readAsset')
  is(asset.trim(), 'This is the content of the asset', 'Read asset from entrypoint')

  const assetFromUtils = await Helper.send(pipe, 'readAssetFromUtils')
  is(assetFromUtils.trim(), 'This is the content of the asset', 'Read asset from lib')

  await Helper.end(pipe)
  ok(true, 'ended')
})
