'use strict'
const test = require('brittle')
const path = require('bare-path')
const os = require('bare-os')
const Helper = require('./helper')

test('teardown', async function ({ teardown, is, ok, plan, comment }) {
  plan(4)

  const helper = new Helper(teardown)
  await helper.bootstrap()

  const dir = path.join(os.cwd(), 'fixtures', 'terminal')

  const id = Math.floor(Math.random() * 10000)

  comment('staging')
  await helper.sink(helper.stage({ id: Math.floor(Math.random() * 10000), channel: `test-${id}`, name: `test-${id}`, dir, dryRun: false, bare: true }, { close: false }))

  comment('seeding')
  const seed = helper.pickMany(helper.seed({ id: Math.floor(Math.random() * 10000), channel: `test-${id}`, name: `test-${id}`, dir }, { close: false }), [{ tag: 'key' }, { tag: 'announced' }])

  const key = await seed.key
  const announced = await seed.announced

  ok(key, 'app key is ok')
  ok(announced, 'seeding is announced')

  comment('running')
  const { inspector, pick, app } = await helper.open(key, { tags: ['teardown', 'exit'] })

  await inspector.evaluate(
    `(() => {
        const { teardown } = Pear;
        teardown(() => console.log('teardown'));
    })()`)

  await inspector.close()
  await helper.closeClients()
  app.kill('SIGTERM')

  const td = await pick.teardown
  is(td, 'teardown', 'teardown has been triggered')

  await helper.shutdown()

  const { code } = await pick.exit
  is(code, 130, 'exit code is 130')
})

test('teardown during teardown', async function ({ teardown, is, ok, plan, comment }) {
  plan(4)

  const helper = new Helper(teardown)
  await helper.bootstrap()

  const dir = path.join(os.cwd(), 'fixtures', 'terminal')

  const id = Math.floor(Math.random() * 10000)

  comment('staging')
  await helper.sink(helper.stage({ id: Math.floor(Math.random() * 10000), channel: `test-${id}`, name: `test-${id}`, dir, dryRun: false, bare: true }, { close: false }))

  comment('seeding')
  const seed = helper.pickMany(helper.seed({ id: Math.floor(Math.random() * 10000), channel: `test-${id}`, name: `test-${id}`, dir }, { close: false }), [{ tag: 'key' }, { tag: 'announced' }])

  const key = await seed.key
  const announced = await seed.announced

  ok(key, 'app key is ok')
  ok(announced, 'seeding is announced')

  comment('running')
  const { inspector, pick, app } = await helper.open(key, { tags: ['teardown', 'exit'] })

  await inspector.evaluate(
    `(() => {
        const { teardown } = Pear
        const a = () => { b() }
        const b = () => { teardown(() => console.log('teardown from b')) }
        teardown( () => a() )
    })()`)

  await inspector.close()
  await helper.closeClients()
  app.kill('SIGTERM')

  const td = await pick.teardown
  is(td, 'teardown from b', 'teardown from b has been triggered')

  await helper.shutdown()

  const { code } = await pick.exit
  is(code, 130, 'exit code is 130')
})

test('exit code', async function ({ teardown, is, ok, plan, comment }) {
  plan(4)

  const helper = new Helper(teardown)
  await helper.bootstrap()

  const dir = path.join(os.cwd(), 'fixtures', 'terminal')

  const id = Math.floor(Math.random() * 10000)

  comment('staging')
  await helper.sink(helper.stage({ id: Math.floor(Math.random() * 10000), channel: `test-${id}`, name: `test-${id}`, dir, dryRun: false, bare: true }, { close: false }))

  comment('seeding')
  const seed = helper.pickMany(helper.seed({ id: Math.floor(Math.random() * 10000), channel: `test-${id}`, name: `test-${id}`, dir }, { close: false }), [{ tag: 'key' }, { tag: 'announced' }])

  const key = await seed.key
  const announced = await seed.announced

  ok(key, 'app key is ok')
  ok(announced, 'seeding is announced')

  comment('running')
  const { inspector, pick, app } = await helper.open(key, { tags: ['teardown', 'exit'] })

  await inspector.evaluate(
    `(() => {
        const { teardown } = Pear;
        teardown(() => global.Bare.exit(124));
    })()`)

  await inspector.evaluate('(() => { return global.__PEAR_TEST__.inspector.disable() })()')
  await inspector.close()
  await helper.closeClients()
  app.kill('SIGTERM')

  await helper.shutdown()

  const { code } = await pick.exit
  is(code, 124, 'exit code is 124')
})
