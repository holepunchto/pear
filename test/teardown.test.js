'use strict'
const test = require('brittle')
const path = require('bare-path')
const os = require('bare-os')
const Helper = require('./helper')
const { Session } = require('pear-inspect')
const { Readable } = require('streamx')

test('teardown', async function ({ teardown, ok, is, plan, comment }) {
  plan(4)

  const helper = new Helper(teardown)
  await helper.bootstrap()

  const dir = path.join(os.cwd(), 'fixtures', 'terminal')

  comment('staging')
  await helper.sink(helper.stage({ id: Math.floor(Math.random() * 10000), channel: 'test', name: 'test', dir, dryRun: false, bare: true }, { close: false }))

  comment('seeding')
  const seed = helper.pickMany(helper.seed({ id: Math.floor(Math.random() * 10000), channel: 'test', name: 'test', dir }, { close: false }), [{ tag: 'key' }, { tag: 'announced' }])

  const key = await seed.key
  const announced = await seed.announced

  ok(key, 'app key is ok')
  ok(announced, 'seeding is announced')

  comment('running')
  const app = await helper.pick(helper.run({ args: [key], dev: true, key, dir }), { tag: 'child' })

  const iterable = new Readable({ objectMode: true })

  app.once('exit', (code, signal) => { iterable.push({ tag: 'exit', data: { code, signal } }) })
  app.stdout.on('data', (data) => {
    if (data.toString().indexOf('teardown') > -1) return iterable.push({ tag: 'teardown', data: data.toString() })
    iterable.push({ tag: 'inspector', data: data.toString() })
  })

  const tag = helper.pickMany(iterable, [{ tag: 'inspector' }, { tag: 'teardown' }, { tag: 'exit' }])

  const ikey = await tag.inspector
  const session = new Session({ inspectorKey: Buffer.from(ikey, 'hex') })
  session.connect()

  await helper.evaluate(session, `(() => {
    const { teardown } = Pear;
    teardown(() => console.log('[inspect] teardown'));
  })()`)

  app.kill('SIGTERM')

  const td = await tag.teardown
  ok(td, 'teardown triggered')

  session.disconnect()
  await session.destroy()
  await helper.destroy()

  const { code } = await tag.exit
  is(code, 130, 'exit code is 130')
})

test('teardown during teardown', async function ({ teardown, ok, is, plan, comment }) {
  plan(4)

  const helper = new Helper(teardown)
  await helper.bootstrap()

  const dir = path.join(os.cwd(), 'fixtures', 'terminal')

  comment('staging')
  await helper.sink(helper.stage({ id: Math.floor(Math.random() * 10000), channel: 'test', name: 'test', dir, dryRun: false, bare: true }, { close: false }))

  comment('seeding')
  const seed = helper.pickMany(helper.seed({ id: Math.floor(Math.random() * 10000), channel: 'test', name: 'test', dir }, { close: false }), [{ tag: 'key' }, { tag: 'announced' }])

  const key = await seed.key
  const announced = await seed.announced

  ok(key, 'app key is ok')
  ok(announced, 'seeding is announced')

  comment('running')
  const app = await helper.pick(helper.run({ args: [key], dev: true, key, dir }), { tag: 'child' })

  const iterable = new Readable({ objectMode: true })

  app.once('exit', (code, signal) => { iterable.push({ tag: 'exit', data: { code, signal } }) })
  app.stdout.on('data', (data) => {
    if (data.toString().indexOf('teardown') > -1) return iterable.push({ tag: 'teardown', data: data.toString() })
    iterable.push({ tag: 'inspector', data: data.toString() })
  })

  const tag = helper.pickMany(iterable, [{ tag: 'inspector' }, { tag: 'teardown' }, { tag: 'exit' }])

  const ikey = await tag.inspector
  const session = new Session({ inspectorKey: Buffer.from(ikey, 'hex') })
  session.connect()

  await helper.evaluate(session, `(() => {
      const { teardown } = Pear
      const a = () => { b() }
      const b = () => { teardown(() => console.log('teardown from b')) }
      teardown( () => a() )
  })()`)

  app.kill('SIGTERM')

  const td = await tag.teardown
  is(td.trim(), 'teardown from b', 'teardown from b has been triggered')

  session.disconnect()
  await session.destroy()
  await helper.destroy()

  const { code } = await tag.exit
  is(code, 130, 'exit code is 130')
})
