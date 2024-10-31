'use strict'
const test = require('brittle')
const path = require('bare-path')
const hypercoreid = require('hypercore-id-encoding')
const Helper = require('./helper')
const workerBasic = path.join(Helper.localDir, 'test', 'fixtures', 'worker-basic')
const workerWithAssets = path.join(Helper.localDir, 'test', 'fixtures', 'worker-with-assets')

test('smoke', async function ({ ok, is, plan, comment, teardown, timeout }) {
  timeout(180000)
  plan(6)

  const key = await build({ dir: workerBasic, ok, comment, teardown })
  const worker = new Worker(`pear://${key}`)

  const versions = await worker.write('versions')
  is(versions.app.key, key, 'app version matches staged key')

  const dhtBootstrap = await worker.write('dhtBootstrap')
  is(JSON.stringify(dhtBootstrap), JSON.stringify(Pear.config.dht.bootstrap), 'dht bootstrap matches Pear.config.dth.bootstrap')

  const res = await worker.write('exit')
  is(res, 'exited', 'worker exited')
})

test('app with assets', async function ({ ok, is, plan, comment, teardown, timeout }) {
  timeout(180000)
  plan(6)

  const key = await build({ dir: workerWithAssets, ok, comment, teardown })
  const worker = new Worker(`pear://${key}`)

  const asset = await worker.write('readAsset')
  is(asset.trim(), 'This is the content of the asset', 'Read asset from entrypoint')

  const assetFromUtils = await worker.write('readAssetFromUtils')
  is(assetFromUtils.trim(), 'This is the content of the asset', 'Read asset from lib')

  const res = await worker.write('exit')
  is(res, 'exited', 'worker exited')
})

class Worker {
  pipe
  constructor (link) {
    this.pipe = Pear.worker.run(link)
  }

  async write (command) {
    return new Promise((resolve) => {
      this.pipe.on('data', (data) => resolve(JSON.parse(data.toString())))
      this.pipe.on('end', () => resolve('exited'))
      this.pipe.write(command)
    })
  }
}

async function build ({ dir, ok, comment, teardown }) {
  const stager = new Helper()
  teardown(() => stager.close(), { order: Infinity })
  await stager.ready()

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

  return key
}
