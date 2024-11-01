'use strict'
const test = require('brittle')
const path = require('bare-path')
const hypercoreid = require('hypercore-id-encoding')
const Helper = require('./helper')
const workerBasic = path.join(Helper.localDir, 'test', 'fixtures', 'worker-basic')
const workerWithAssets = path.join(Helper.localDir, 'test', 'fixtures', 'worker-with-assets')

test('smoke', async function ({ ok, is, plan, comment, teardown, timeout }) {
  timeout(180000)
  plan(3)

  const helper = new Helper()
  const { key } = await helper.build({ dir: workerBasic, comment, teardown })
  helper.__open(`pear://${key}`)

  const versions = await helper.sendAndWait('versions')
  is(versions.value.app.key, key, 'app version matches staged key')

  const dhtBootstrap = await helper.sendAndWait('dhtBootstrap')
  is(JSON.stringify(dhtBootstrap.value), JSON.stringify(Pear.config.dht.bootstrap), 'dht bootstrap matches Pear.config.dth.bootstrap')

  const res = await helper.sendAndWait('exit')
  is(res, 'exited', 'worker exited')
})

test('app with assets', async function ({ ok, is, plan, comment, teardown, timeout }) {
  timeout(180000)
  plan(3)

  const helper = new Helper()
  const { key } = await helper.build({ dir: workerWithAssets, comment, teardown })
  helper.__open(`pear://${key}`)

  const asset = await helper.sendAndWait('readAsset')
  is(asset.value.trim(), 'This is the content of the asset', 'Read asset from entrypoint')

  const assetFromUtils = await helper.sendAndWait('readAssetFromUtils')
  is(assetFromUtils.value.trim(), 'This is the content of the asset', 'Read asset from lib')

  const res = await helper.sendAndWait('exit')
  is(res, 'exited', 'worker exited')
})
