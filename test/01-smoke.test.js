'use strict'
const test = require('brittle')
const path = require('bare-path')
const os = require('bare-os')
const Helper = require('./helper')

test('smoke', async function ({ teardown, ok, is, plan, comment }) {
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

  global.testAppKey = key

  comment('running')
  const { inspector, pick } = await helper.launch(key, { tags: ['exit'] })

  const { value } = await inspector.evaluate(
    `(async () => {
        const { versions } = Pear;
        return await versions();
      })()`,
    { awaitPromise: true })

  is(value?.app?.key, key, 'app version matches staged key')

  await inspector.evaluate('(() => { return global.endInspection() })()')

  await inspector.close()
  await helper.close()

  const { code } = await pick.exit
  is(code, 0, 'exit code is 0')
})
