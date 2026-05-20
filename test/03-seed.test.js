'use strict'
const test = require('brittle')
const tmp = require('test-tmp')
const Corestore = require('corestore')
const Hyperdrive = require('hyperdrive')
const Hyperswarm = require('hyperswarm')
const hypercoreid = require('hypercore-id-encoding')
const Helper = require('./helper')

test('pear seed basic stage and seed', async function ({ ok, plan, comment, teardown, timeout }) {
  timeout(180000)
  plan(3)

  const dir = Helper.fixture('versions')

  const helper = new Helper()
  teardown(() => helper.close(), { order: Infinity })
  await helper.ready()
  const link = await Helper.touchLink(helper)

  comment('staging')
  const staging = helper.stage({
    link,
    dir,
    dryRun: false
  })
  teardown(() => Helper.teardownStream(staging))
  const staged = await Helper.pick(staging, { tag: 'final' })
  ok(staged.success, 'stage succeeded')

  comment('seeding')
  const seeding = helper.seed({
    link,
    dir,
    key: null,
    cmdArgs: []
  })
  teardown(() => Helper.teardownStream(seeding))
  const until = await Helper.pick(seeding, [{ tag: 'key' }, { tag: 'announced' }])
  const announced = await until.announced
  ok(announced, 'seeding is announced')

  const key = await until.key
  ok(hypercoreid.isValid(key), 'app key is valid')
})

test('pear seed announces, join, drop', async function ({ ok, plan, comment, teardown, timeout }) {
  timeout(180000)
  plan(3)

  const dir = Helper.fixture('minimal')
  const helper = new Helper()
  teardown(() => helper.close(), { order: Infinity })
  await helper.ready()
  const link = await Helper.touchLink(helper)

  comment('staging')
  const staging = helper.stage({
    link,
    dir,
    dryRun: false
  })
  teardown(() => Helper.teardownStream(staging))
  await Helper.pick(staging, { tag: 'final' })

  comment('seeding')
  const seeding = helper.seed({
    link,
    dir,
    key: null,
    cmdArgs: []
  })
  teardown(() => Helper.teardownStream(seeding))
  const until = await Helper.pick(seeding, [
    { tag: 'key' },
    { tag: 'announced' },
    { tag: 'peer-add' },
    { tag: 'peer-remove' }
  ])
  const announced = await until.announced
  ok(announced, 'seeding is announced')
  const key = await until.key
  console.log('test 1')
  const peerStore = new Corestore(await tmp())
  console.log('test 2')
  teardown(() => peerStore.close())
  await peerStore.ready()
  console.log('test 3')
  const peerDrive = new Hyperdrive(peerStore, key)
  await peerDrive.ready()
  console.log('test 4')
  
  const peerSwarm = new Hyperswarm({ bootstrap: Helper.dhtBootstrap })
  teardown(() => peerSwarm.destroy())
  peerSwarm.on('connection', (conn) => {
    peerDrive.corestore.replicate(conn)
  })
  peerSwarm.join(peerDrive.discoveryKey)
  await peerDrive.get('/package.json')
  console.log('test 5')
  
  const joined = await until['peer-add']
  console.log('test 6')
  ok(joined, 'peer joins')
  
  await peerSwarm.destroy()
  console.log('test 7')
  
  const dropped = await until['peer-remove']
  console.log('test 8')
  ok(dropped, 'peer drops')
})
