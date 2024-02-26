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
  const app = helper.pickMany(helper.run({ dev: true, key, dir }), [{ tag: 'exit' }, { tag: 'inspector' }])

  const inspector = await app.inspector
  ok(inspector, 'inspector is ready')

  const result = await helper.evaluate(inspector, '(() => \'READY\')()')
  is(result?.value, 'READY', 'app is ready')

  comment('\tlistening to updates')
  const watchUpdates = (() => {
    global._updates = []
    Pear.updates((data) => {
      global._updates = [...global._updates, data]
    })
  }).toString()
  await helper.evaluate(inspector, `(${watchUpdates})()`)

  comment('2. Create new file, restage, and reseed')

  comment(`\tcreating test file (${ts}.txt)`)
  writeFileSync(path.join(dir, `${ts}.txt`), 'test')

  comment('\tstaging')
  await helper.sink(helper.stage(stageOpts(), { close: false }))

  unlinkSync(path.join(dir, `${ts}.txt`))

  comment('\tseeding')
  const seed2 = helper.pickMany(helper.seed(seedOpts(), { close: false }), [{ tag: 'key' }, { tag: 'announced' }])
  const seed2Key = await seed2.key
  const seed2Announced = await seed2.announced
  ok(seed2Key, `reseeded platform key (${seed2Key})`)
  ok(seed2Announced, 'reseed announced')

  const awaitUpdates = (async function (length) {
    while (global._updates?.length < length)
      await new Promise(resolve => setTimeout(resolve, 100))

    return global._updates
  }).toString()
  const updates = await helper.evaluate(inspector, `(${awaitUpdates})(1)`, true)
  is(updates?.value?.length, 1, 'app updated after stage')

  await helper.evaluate(inspector, 'global.endInspection()')

  await helper.closeClients()
  await helper.shutdown()

  const { code } = await app.exit
  is(code, 0, 'exit code is 0')
})
