'use strict'
const test = require('brittle')
const path = require('bare-path')
const os = require('bare-os')
const Helper = require('./helper')

test('smoke', async function ({ teardown, ok, is, plan, comment }) {
  plan(4)

  const helper = new Helper()
  await helper.ready()

  const dir = path.join(os.cwd(), 'fixtures', 'terminal')

  const id = Math.floor(Math.random() * 10000)

  comment('staging')
  await Helper.sink(Helper.stage({ id: Math.floor(Math.random() * 10000), channel: `test-${id}`, name: `test-${id}`, dir, dryRun: false, bare: true }, { close: false }))

  comment('seeding')
  const seed = Helper.pickMany(helper.seed({ id: Math.floor(Math.random() * 10000), channel: `test-${id}`, name: `test-${id}`, dir }, { close: false }), [{ tag: 'key' }, { tag: 'announced' }])

  const key = await seed.key
  const announced = await seed.announced

  ok(key, 'app key is ok')
  ok(announced, 'seeding is announced')

  comment('running')
  const { inspector, pick } = await helper.open(key, { tags: ['exit'] })

  const { value } = await inspector.evaluate(
    `(async () => {
        const { versions } = Pear;
        return await versions();
      })()`,
    { awaitPromise: true })

  is(value?.app?.key, key, 'app version matches staged key')

  await inspector.close()
  await helper.close()

  const { code } = await pick.exit
  is(code, 0, 'exit code is 0')
})
