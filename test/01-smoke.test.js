'use strict'
const test = require('brittle')
const path = require('bare-path')
const hypercoreid = require('hypercore-id-encoding')
const Helper = require('./helper')
const workerBasic = path.join(Helper.localDir, 'test', 'fixtures', 'worker-basic')
const workerWithAssets = path.join(Helper.localDir, 'test', 'fixtures', 'worker-with-assets')

test('smoke', async function ({ ok, is, plan, comment, teardown, timeout, end }) {
  timeout(180000)
  plan(6)
  const stager = new Helper()
  teardown(() => stager.close(), { order: Infinity })
  await stager.ready()
  const dir = workerBasic

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

  const pipe = Pear.worker.run(link)
  async function pipeWrite (type) {
    return new Promise((resolve) => {
      pipe.on('data', (data) => {
        const value = JSON.parse(data.toString())
        resolve(value)
      })
      pipe.on('end', () => {
        resolve('exited')
      })
      pipe.write(type)
    })
  }

  const versions = await pipeWrite('versions')
  is(versions.app.key, key, 'app version matches staged key')

  const dhtBootstrap = await pipeWrite('dhtBootstrap')
  is(JSON.stringify(dhtBootstrap), JSON.stringify(Pear.config.dht.bootstrap), 'dht bootstrap matches Pear.config.dth.bootstrap')

  const res = await pipeWrite('exit')
  is(res, 'exited', 'worker exited')
})

test('app with assets', async function ({ is, plan, comment, teardown, timeout }) {
  timeout(180000)
  plan(3)
  const stager = new Helper()
  teardown(() => stager.close(), { order: Infinity })
  await stager.ready()
  const dir = workerWithAssets

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

  const pipe = Pear.worker.run(link)
  async function pipeWrite (type) {
    return new Promise((resolve) => {
      pipe.on('data', (data) => {
        const value = JSON.parse(data.toString())
        resolve(value)
      })
      pipe.on('end', () => {
        resolve('exited')
      })
      pipe.write(type)
    })
  }

  const asset = await pipeWrite('readAsset')
  is(asset.trim(), 'This is the content of the asset', 'Read asset from entrypoint')

  const assetFromUtils = await pipeWrite('readAssetFromUtils')
  is(assetFromUtils.trim(), 'This is the content of the asset', 'Read asset from lib')

  const res = await pipeWrite('exit')
  is(res, 'exited', 'worker exited')
})
