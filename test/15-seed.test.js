'use strict'
const test = require('brittle')
const tmp = require('test-tmp')
const Corestore = require('corestore')
const Hyperdrive = require('hyperdrive')
const Hyperswarm = require('hyperswarm')
const Helper = require('./helper')

test('pear seed announce, join, drop', async function ({ ok, plan, comment, teardown, timeout }) {
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

  const peerStore = new Corestore(await tmp())
  teardown(() => peerStore.close())
  await peerStore.ready()

  const peerDrive = new Hyperdrive(peerStore, key)
  await peerDrive.ready()

  const peerSwarm = new Hyperswarm({ bootstrap: Pear.app.dht.bootstrap })
  teardown(() => peerSwarm.destroy())
  peerSwarm.on('connection', (conn) => {
    peerDrive.corestore.replicate(conn)
  })

  peerSwarm.join(peerDrive.discoveryKey)
  await peerDrive.get('/package.json')

  const joined = await until['peer-add']
  ok(joined, 'seeding reports peer join')

  await peerSwarm.destroy()

  const dropped = await until['peer-remove']
  ok(dropped, 'seeding reports peer drop')
})
