'use strict'

/* global Pear,global */
const test = require('brittle')
const Helper = require('./helper')
const path = require('bare-path')
const os = require('bare-os')
const { writeFileSync, unlinkSync } = require('bare-fs')
const z32 = require('z32')

const seedOpts = (id) => ({
  channel: `test-${id}`, name: `test-${id}`, key: null, dir, clientArgv: [], id: Math.floor(Math.random() * 10000)
})
const stageOpts = (id) => ({ ...seedOpts(id), dryRun: false, bare: true, ignore: [] })
const releaseOpts = (id, key) => ({
  id: Math.floor(Math.random() * 10000), channel: `test-${id}`, name: `test-${id}`, key
})
const ts = () => new Date().toISOString().replace(/[:.]/g, '-')
const dir = path.join(os.cwd(), 'fixtures', 'terminal')

test('Pear.updates() should be called when restaging and releasing', async function (t) {
  const { teardown, ok, is, plan, timeout, comment } = t

  plan(10)
  timeout(180000)

  const testId = Math.floor(Math.random() * 100000)

  const helper = new Helper(teardown)
  await helper.bootstrap()

  comment('1. Stage, seed, and run app')

  comment('\tstaging')
  await helper.sink(helper.stage(stageOpts(testId), { close: false }))

  comment('\tseeding')
  const seed = helper.pickMany(helper.seed(seedOpts(testId), { close: false }), [{ tag: 'key' }, { tag: 'announced' }])
  const key = await seed.key
  const announced = seed.announced
  ok(key, `seeded platform key (${key})`)
  ok(announced, 'seeding announced')

  comment('\trunning')
  const { inspector, pick } = await helper.open(key, { tags: ['exit'] })

  comment('\tlistening to updates')
  const watchUpdates = (() => {
    global.__PEAR_TEST__.updates = { app: [], platform: [] }
    Pear.updates((data) => {
      const type = data?.app ? 'app' : 'platform'
      global.__PEAR_TEST__.updates[type] = [...global.__PEAR_TEST__.updates[type], data]
    })
  }).toString()
  await inspector.evaluate(`(${watchUpdates})()`)

  comment('2. Create new file, restage, and reseed')

  const file1 = `${ts()}.txt`
  comment(`\tcreating test file (${file1})`)
  writeFileSync(path.join(dir, file1), 'test')

  comment('\tstaging')
  await helper.sink(helper.stage(stageOpts(testId), { close: false }))

  unlinkSync(path.join(dir, file1))

  comment('\tseeding')
  const seed2 = helper.pickMany(helper.seed(seedOpts(testId), { close: false }), [{ tag: 'key' }, { tag: 'announced' }])
  const seed2Key = await seed2.key
  const seed2Announced = seed2.announced
  ok(seed2Key, `reseeded platform key (${seed2Key})`)
  ok(seed2Announced, 'reseed announced')

  const awaitUpdates = async function (length, type = 'app') {
    while (global.__PEAR_TEST__.updates[type]?.length < length) {
      await new Promise(resolve => setTimeout(resolve, 100))
    }

    return global.__PEAR_TEST__.updates[type]
  }.toString()
  const update1 = await inspector.evaluate(`(${awaitUpdates})(1)`, { awaitPromise: true })
  const update1Version = update1?.value?.[0]?.version
  is(update1?.value?.length, 1, 'app updated after stage')
  is(z32.encode(Buffer.from(update1Version?.key, 'hex')), key, 'app updated with matching key')

  comment('releasing')
  await helper.pick(helper.release(releaseOpts(testId, key), { close: false }), { tag: 'released' })

  comment('waiting for update')
  const update2 = await inspector.evaluate(`(${awaitUpdates})(2)`, { awaitPromise: true })
  is(update2?.value?.length, 2, 'app reupdated after release')

  const update2Version = update2?.value?.[1]?.version
  is(z32.encode(Buffer.from(update2Version?.key, 'hex')), key, 'app update2 with matching key')
  ok(update2Version?.length > update1Version?.length, 'app version incremented')

  await inspector.evaluate('global.__PEAR_TEST__.inspector.disable()')

  await inspector.close()
  await helper.close()

  const { code } = await pick.exit
  is(code, 0, 'exit code is 0')
})

test('Pear.updates() should be called twice when restaging twice', async function (t) {
  const { teardown, ok, is, plan, timeout, comment } = t

  plan(12)
  timeout(180000)

  const testId = Math.floor(Math.random() * 100000)

  const helper = new Helper(teardown)
  await helper.bootstrap()

  const dir = path.join(os.cwd(), 'fixtures', 'terminal')

  comment('1. Stage, seed, and run app')

  comment('\tstaging')
  await helper.sink(helper.stage(stageOpts(testId), { close: false }))

  comment('\tseeding')
  const seed = helper.pickMany(helper.seed(seedOpts(testId), { close: false }), [{ tag: 'key' }, { tag: 'announced' }])
  const key = await seed.key
  const announced = seed.announced
  ok(key, `seeded platform key (${key})`)
  ok(announced, 'seeding announced')

  comment('\trunning')
  const { inspector, pick } = await helper.open(key, { tags: ['exit'] })

  comment('\tlistening to updates')
  const watchUpdates = (() => {
    global.__PEAR_TEST__.updates = { app: [], platform: [] }
    Pear.updates((data) => {
      const type = data?.app ? 'app' : 'platform'
      global.__PEAR_TEST__.updates[type] = [...global.__PEAR_TEST__.updates[type], data]
    })
  }).toString()
  await inspector.evaluate(`(${watchUpdates})()`)

  comment('2. Create new file, restage, and reseed')

  const file1 = `${ts()}.txt`
  comment(`\tcreating test file (${file1})`)
  writeFileSync(path.join(dir, file1), 'test')

  comment('\tstaging')
  await helper.sink(helper.stage(stageOpts(testId), { close: false }))

  unlinkSync(path.join(dir, file1))

  comment('\tseeding')
  const seed2 = helper.pickMany(helper.seed(seedOpts(testId), { close: false }), [{ tag: 'key' }, { tag: 'announced' }])
  const seed2Key = await seed2.key
  const seed2Announced = seed2.announced
  ok(seed2Key, `reseeded platform key (${seed2Key})`)
  ok(seed2Announced, 'reseed announced')

  const awaitUpdates = async function (length, type = 'app') {
    while (global.__PEAR_TEST__.updates[type]?.length < length) {
      await new Promise(resolve => setTimeout(resolve, 100))
    }

    return global.__PEAR_TEST__.updates[type]
  }.toString()
  const update1 = await inspector.evaluate(`(${awaitUpdates})(1)`, { awaitPromise: true })
  const update1Version = update1?.value?.[0]?.version
  is(update1?.value?.length, 1, 'app updated after stage')
  is(z32.encode(Buffer.from(update1Version?.key, 'hex')), key, 'app updated with matching key')

  comment('3. Create another file, restage, and reseed')

  const file2 = `${ts()}.txt`
  comment(`\tcreating another test file (${file2})`)
  writeFileSync(path.join(dir, file2), 'test')

  comment('\trestaging')
  await helper.sink(helper.stage(stageOpts(testId), { close: false }))

  unlinkSync(path.join(dir, file2))

  comment('\treseeding')
  const seed3 = helper.pickMany(helper.seed(seedOpts(testId), { close: false }), [{ tag: 'key' }, { tag: 'announced' }])
  const seed3Key = await seed3.key
  const seed3Announced = seed3.announced
  ok(seed3Key, `reseeded platform key (${seed3Key})`)
  ok(seed3Announced, 'reseed announced')

  comment('waiting for update')
  const update2 = await inspector.evaluate(`(${awaitUpdates})(2)`, { awaitPromise: true })
  is(update2?.value?.length, 2, 'app reupdated after staging again')

  const update2Version = update2?.value?.[1]?.version
  is(z32.encode(Buffer.from(update2Version?.key, 'hex')), key, 'app update2 with matching key')
  ok(update2Version?.length > update1Version?.length, 'app version incremented')

  await inspector.evaluate('global.__PEAR_TEST__.inspector.disable()')

  await inspector.close()
  await helper.close()

  const { code } = await pick.exit
  is(code, 0, 'exit code is 0')
})
