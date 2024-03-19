'use strict'
const test = require('brittle')
const path = require('bare-path')
const os = require('bare-os')
const Helper = require('./helper')

test('shutdown file lock', async function ({ teardown, is, ok, plan, comment }) {
  plan(8)

  const helper = new Helper(teardown)
  await helper.bootstrap()

  let unlocked = await helper.accessLock()
  is(unlocked, false, 'platform file is locked')

  await helper.close()

  unlocked = await helper.accessLock()
  is(unlocked, true, 'platform file is not locked')

  await helper.bootstrap()

  unlocked = await helper.accessLock()
  is(unlocked, false, 'platform file is locked')

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

  unlocked = await helper.accessLock()
  is(unlocked, true, 'platform file is not locked')
})
