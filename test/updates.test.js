const test = require('brittle')
const Helper = require('./helper')
const path = require('bare-path')
const os = require('bare-os')
const { writeFileSync, unlinkSync } = require('bare-fs')

test('Pear.updates', async function ({ teardown, ok, is, plan, timeout, comment }) {
  plan(7)
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

  comment('staging')
  await helper.sink(helper.stage(stageOpts(), { close: false }))

  comment('seeding')
  const seed = helper.pickMany(helper.seed(seedOpts(), { close: false }), [{ tag: 'key' }, { tag: 'announced' }])
  const key = await seed.key
  const announced = await seed.announced
  ok(key, `seeded platform key (${key})`)
  ok(announced, 'seeding announced')

  comment('running')
  const app = helper.pickMany(helper.run({
    args: [key, '--debug=ready,updates'], dev: true, key, dir
  }), [{ tag: 'ready' }, { tag: 'exit' }, { tag: 'update1' }])

  const ready = await app.ready
  is(ready?.toString(), '[DEBUG] READY\n', 'app is ready')

  comment('2. Create new file, restage, and reseed')

  comment(`creating test file (${ts}.txt)`)
  writeFileSync(path.join(dir, `${ts}.txt`), 'test')
  teardown(() => unlinkSync(path.join(dir, `${ts}.txt`)))

  comment('staging')
  await helper.sink(helper.stage(stageOpts(), { close: false }))

  comment('seeding')
  const seed2 = helper.pickMany(helper.seed(seedOpts(), { close: false }), [{ tag: 'key' }, { tag: 'announced' }])
  const seed2Key = await seed2.key
  const seed2Announced = await seed2.announced
  ok(seed2Key, `reseeded platform key (${seed2Key})`)
  ok(seed2Announced, 'reseed announced')

  const updated = await Promise.any([app.update1, helper.sleep(5000)])
  is(updated?.toString(), '[DEBUG] UPDATE1\n', 'app updated after stage')

  await helper.closeClients()
  await helper.shutdown()

  const { code } = await app.exit
  is(code, 0, 'exit code is 0')
})
