'use strict'

/* global Pear,global */
const test = require('brittle')
const Helper = require('./helper')
const path = require('bare-path')
const os = require('bare-os')
const { writeFileSync, unlinkSync } = require('bare-fs')

test('Pear.updates', async function ({ teardown, ok, is, plan, timeout, comment }) {
  plan(8)
  timeout(180000)

  const helper = new Helper(teardown)
  await helper.bootstrap()

  const dir = path.join(os.cwd(), 'fixtures', 'terminal')

  const seedOpts = () => ({
    channel: 'test', name: 'test', key: null, dir, clientArgv: [], id: Math.floor(Math.random() * 10000)
  })
  const stageOpts = () => ({ ...seedOpts(), dryRun: false, bare: true, ignore: [] })
  const releaseOpts = (key) => ({ id: Math.floor(Math.random() * 10000), channel: 'test', name: 'test', key })
  const ts = new Date().toISOString().replace(/[:.]/g, '-')

  comment('1. Stage, seed, and run app')

  comment('\tstaging')
  await helper.sink(helper.stage(stageOpts(), { close: false }))

  comment('\tseeding')
  const seed = helper.pickMany(helper.seed(seedOpts(), { close: false }), [{ tag: 'key' }, { tag: 'announced' }])
  const key = await seed.key
  const announced = await seed.announced
  ok(key, `seeded platform key (${key})`)
  ok(announced, 'seeding announced')

  comment('\trunning')
  const { inspector, pick } = await helper.open(key, { tags: ['exit'] })

  const result = await inspector.evaluate('(() => \'READY\')()')
  is(result?.value, 'READY', 'app is ready')

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

  comment(`\tcreating test file (${ts}.txt)`)
  writeFileSync(path.join(dir, `${ts}.txt`), 'test')

  comment('\tstaging')
  await helper.sink(helper.stage(stageOpts(), { close: false }))

  unlinkSync(path.join(dir, `${ts}.txt`))

  comment('\tseeding')
  const seed2 = helper.pickMany(helper.seed(seedOpts(), { close: false }), [{ tag: 'key' }, { tag: 'announced' }])
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
  const updates = await inspector.evaluate(`(${awaitUpdates})(1)`, { awaitPromise: true })
  is(updates?.value?.length, 1, 'app updated after stage')

  comment('releasing')
  await helper.pick(helper.release(releaseOpts(key), { close: false }), { tag: 'released' })

  comment('waiting for update')
  const reupdated = await inspector.evaluate(`(${awaitUpdates})(2)`, { awaitPromise: true })
  is(reupdated?.value?.length, 2, 'app reupdated after release')

  await inspector.evaluate('global.__PEAR_TEST__.inspector.disable()')

  await inspector.close()
  await helper.close()

  const { code } = await pick.exit
  is(code, 0, 'exit code is 0')
})
