'use strict'
const test = require('brittle')
const path = require('bare-path')
const os = require('bare-os')
const Helper = require('./helper')

test('smoke', async function ({ teardown, ok, is, plan, timeout, comment }) {
  plan(3)
  timeout(60000)

  const helper = new Helper(teardown)
  await helper.bootstrap()

  const dir = path.join(os.cwd(), 'fixtures', 'terminal')

  comment('staging')
  await helper.sink(helper.stage({
    id: Math.floor(Math.random() * 10000),
    channel: 'test',
    name: 'test',
    key: null,
    dir,
    dryRun: false,
    bare: true,
    ignore: [],
    clientArgv: []
  }, { close: false }))

  comment('seeding')
  const seed = helper.pickMany(helper.seed({
    id: Math.floor(Math.random() * 10000),
    channel: 'test',
    name: 'test',
    key: null,
    dir,
    clientArgv: []
  }, { close: false }), [{ tag: 'key' }, { tag: 'announced' }])

  const key = await seed.key
  const announced = await seed.announced

  ok(key, 'platform key is ok')
  ok(announced, 'seeding is announced')

  comment('running')
  const app = helper.pickMany(helper.run({
    args: [key, '--debug=ready'],
    dev: true,
    key,
    dir
  }), [{ tag: 'ready' }, { tag: 'exit' }])

  await app.ready

  await helper.closeClients()
  await helper.shutdown()

  const { code } = await app.exit
  is(code, 0, 'exit code is 0')
})

test('ipc shutdown', async function ({ timeout, ok, absent, is, teardown, comment }) {
  timeout(60000)

  const helper = new Helper(teardown)
  await helper.bootstrap()

  let p = await helper.lookup('sidecar')
  ok(p, 'there are sidecars')

  await helper.closeClients()
  await helper.shutdown()

  p = await helper.lookup('sidecar')
  absent(p, 'no sidecars')

  await helper.bootstrap()

  const dir = path.join(os.cwd(), 'fixtures', 'terminal')

  comment('staging')
  await helper.sink(helper.stage({
    id: Math.floor(Math.random() * 10000),
    channel: 'test',
    name: 'test',
    key: null,
    dir,
    dryRun: false,
    bare: true,
    ignore: [],
    clientArgv: []
  }, { close: false }))

  comment('seeding')
  const seed = helper.pickMany(helper.seed({
    id: Math.floor(Math.random() * 10000),
    channel: 'test',
    name: 'test',
    key: null,
    dir,
    clientArgv: []
  }, { close: false }), [{ tag: 'key' }, { tag: 'announced' }])

  const key = await seed.key
  const announced = await seed.announced

  ok(key, 'app key is ok')
  ok(announced, 'seeding is announced')

  comment('running')
  const app = helper.pickMany(helper.run({
    args: [key, '--debug=ready'],
    dev: true,
    key,
    dir
  }), [{ tag: 'ready' }, { tag: 'exit' }])

  await app.ready

  p = await helper.lookup('sidecar')
  ok(p, 'there are sidecars')

  await helper.closeClients()
  await helper.shutdown()

  const { code } = await app.exit
  is(code, 0, 'exit code is 0')

  p = await helper.lookup('sidecar')
  absent(p, 'no sidecars')
})
