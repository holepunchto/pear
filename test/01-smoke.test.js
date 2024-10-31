'use strict'
const test = require('brittle')
const path = require('bare-path')
const { Helper, WorkerHelper } = require('./helper')
const workerBasic = path.join(Helper.localDir, 'test', 'fixtures', 'worker-basic')
const workerWithAssets = path.join(Helper.localDir, 'test', 'fixtures', 'worker-with-assets')

test('smoke', async function ({ ok, is, plan, comment, teardown, timeout }) {
  timeout(180000)
  plan(6)

  const worker = new WorkerHelper()
  const { key } = await worker.run({ dir: workerBasic, ok, comment, teardown })

  const versions = await worker.writeAndWait('versions')
  is(versions.value.app.key, key, 'app version matches staged key')

  const dhtBootstrap = await worker.writeAndWait('dhtBootstrap')
  is(JSON.stringify(dhtBootstrap.value), JSON.stringify(Pear.config.dht.bootstrap), 'dht bootstrap matches Pear.config.dth.bootstrap')

  const res = await worker.writeAndWait('exit')
  is(res, 'exited', 'worker exited')
})

test('app with assets', async function ({ ok, is, plan, comment, teardown, timeout }) {
  timeout(180000)
  plan(6)

  const worker = new WorkerHelper()
  await worker.run({ dir: workerWithAssets, ok, comment, teardown })

  const asset = await worker.writeAndWait('readAsset')
  is(asset.value.trim(), 'This is the content of the asset', 'Read asset from entrypoint')

  const assetFromUtils = await worker.writeAndWait('readAssetFromUtils')
  is(assetFromUtils.value.trim(), 'This is the content of the asset', 'Read asset from lib')

  const res = await worker.writeAndWait('exit')
  is(res, 'exited', 'worker exited')
})
