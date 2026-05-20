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
  const until = await Helper.pick(seeding, [{ tag: 'key' }, { tag: 'announced' }])
  const announced = await until.announced
  ok(announced, 'seeding is announced')
  const key = await until.key

  const peerStore = new Corestore(await tmp())
  teardown(() => peerStore.close())
  await peerStore.ready()
  const peerDrive = new Hyperdrive(peerStore, key)
  await peerDrive.ready()

  const peerSwarm = new Hyperswarm({ bootstrap: Helper.dhtBootstrap })
  teardown(() => peerSwarm.destroy())
  let peerConn = null
  const joinedPromise = new Promise((resolve) => {
    peerSwarm.once('connection', (conn) => {
      peerConn = conn
      resolve(true)
    })
  })
  peerSwarm.on('connection', (conn) => {
    peerDrive.corestore.replicate(conn)
  })
  peerSwarm.join(peerDrive.discoveryKey)
  await peerSwarm.flush()

  const joined = await withTimeout(joinedPromise, 45000, 'peer connection timeout')
  ok(joined, 'peer joins')

  await withTimeout(peerDrive.get('/package.json'), 45000, 'package fetch timeout')

  const droppedPromise = new Promise((resolve) => {
    if (!peerConn) return resolve(false)
    peerConn.once('close', () => resolve(true))
  })
  await peerSwarm.destroy()

  const dropped = await withTimeout(droppedPromise, 45000, 'peer connection close timeout')
  ok(dropped, 'peer drops')
})

function withTimeout(promise, ms, msg) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(msg)), ms)
    promise.then(
      (value) => {
        clearTimeout(timer)
        resolve(value)
      },
      (err) => {
        clearTimeout(timer)
        reject(err)
      }
    )
  })
}
