const test = require('brittle')
const Helper = require('./helper')
const path = require('bare-path')
const os = require('bare-os')
const { writeFileSync, unlinkSync } = require('bare-fs')

test('Pear.updates', async function ({ teardown, ok, is, plan, timeout, comment }) {
  plan(12)
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
  }), [{ tag: 'ready' }, { tag: 'exit' }, { tag: 'update1' }, { tag: 'update2' }, { tag: 'update3' }])

  const ready = await app.ready
  is(ready?.toString(), '[DEBUG] READY\n', 'app is ready')

  comment('2. Create new file, restage, reseed, and release')

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

  comment('releasing')
  await helper.pick(helper.release(releaseOpts(key), { close: false }), { tag: 'released' })

  const reupdated = await Promise.any([app.update2, helper.sleep(5000)])
  is(reupdated?.toString(), '[DEBUG] UPDATE2\n', 'app reupdated after release')

  comment('3. Create another file, restage, reseed, and release again')

  comment(`creating test file (${ts}-2.txt)`)
  writeFileSync(path.join(dir, `${ts}-2.txt`), 'test')
  teardown(() => unlinkSync(path.join(dir, `${ts}-2.txt`)))

  comment('staging')
  await helper.sink(helper.stage(stageOpts(), { close: false }))

  comment('seeding')
  const seed3 = helper.pickMany(helper.seed(seedOpts(), { close: false }), [{ tag: 'key' }, { tag: 'announced' }])
  const seed3Key = await seed3.key
  const seed3Announced = await seed3.announced
  ok(seed3Key, `reseeded platform key (${seed3Key})`)
  ok(seed3Announced, 'reseed announced')

  const reupdated2 = await Promise.any([app.update3, helper.sleep(5000)])
  is(reupdated2?.toString(), undefined, 'update should not get triggered when staging after release')

  comment('releasing')
  await helper.pick(helper.release(releaseOpts(), { close: false }), { tag: 'released' })

  const reupdated3 = await Promise.any([app.update3, helper.sleep(5000)])
  is(reupdated3?.toString(), '[DEBUG] UPDATE3\n', 'app reupdated after 2nd release')

  await helper.closeClients()
  await helper.shutdown()

  const { code } = await app.exit
  is(code, 0, 'exit code is 0')
})
