'use strict'

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
const awaitUpdate = '(async () => new Promise(resolve => Pear.updates().once("data", resolve)))()'

test('Pear.updates() should be called when restaging and releasing', async function (t) {
  const { teardown, ok, is, plan, timeout, comment } = t

  plan(11)
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

  comment('2. Create new file, restage, and reseed')

  const file1 = `${ts()}.txt`
  comment(`\tcreating test file (${file1})`)
  writeFileSync(path.join(dir, file1), 'test')

  comment('\tstaging')
  const update1Promise = await inspector.evaluate(awaitUpdate, { returnByValue: false })
  await helper.sink(helper.stage(stageOpts(testId), { close: false }))

  unlinkSync(path.join(dir, file1))

  comment('\tseeding')
  const seed2 = helper.pickMany(helper.seed(seedOpts(testId), { close: false }), [{ tag: 'key' }, { tag: 'announced' }])
  const seed2Key = await seed2.key
  const seed2Announced = seed2.announced
  ok(seed2Key, `reseeded platform key (${seed2Key})`)
  ok(seed2Announced, 'reseed announced')

  const update1 = await inspector.awaitPromise(update1Promise.objectId)
  const update1Version = update1?.value?.version
  is(z32.encode(Buffer.from(update1Version?.key, 'hex')), key, 'app updated with matching key')
  is(update1Version?.fork, 0, 'app version.fork is 0')
  ok(update1Version?.length > 0, `app version.length is non-zero (v${update1Version?.fork}.${update1Version?.length})`)

  comment('releasing')
  const update2Promise = await inspector.evaluate(awaitUpdate, { returnByValue: false })
  await helper.pick(helper.release(releaseOpts(testId, key), { close: false }), { tag: 'released' })

  comment('waiting for update')
  const update2 = await inspector.awaitPromise(update2Promise.objectId)
  const update2Version = update2?.value?.version
  is(z32.encode(Buffer.from(update2Version?.key, 'hex')), key, 'app updated with matching key')
  is(update2Version?.fork, 0, 'app version.fork is 0')
  ok(update2Version?.length > update1Version?.length, `app version.length incremented (v${update2Version?.fork}.${update2Version?.length})`)

  await inspector.evaluate('global.__PEAR_TEST__.inspector.disable()')

  await inspector.close()
  await helper.close()

  const { code } = await pick.exit
  is(code, 0, 'exit code is 0')
})

test('Pear.updates() should be called twice when restaging twice', async function (t) {
  const { teardown, ok, is, plan, timeout, comment } = t

  plan(13)
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

  comment('2. Create new file, restage, and reseed')

  const file1 = `${ts()}.txt`
  comment(`\tcreating test file (${file1})`)
  writeFileSync(path.join(dir, file1), 'test')

  comment('\tstaging')
  const update1Promise = await inspector.evaluate(awaitUpdate, { returnByValue: false })
  await helper.sink(helper.stage(stageOpts(testId), { close: false }))

  unlinkSync(path.join(dir, file1))

  comment('\tseeding')
  const seed2 = helper.pickMany(helper.seed(seedOpts(testId), { close: false }), [{ tag: 'key' }, { tag: 'announced' }])
  const seed2Key = await seed2.key
  const seed2Announced = seed2.announced
  ok(seed2Key, `reseeded platform key (${seed2Key})`)
  ok(seed2Announced, 'reseed announced')

  const update1 = await inspector.awaitPromise(update1Promise.objectId)
  const update1Version = update1?.value?.version
  is(z32.encode(Buffer.from(update1Version?.key, 'hex')), key, 'app updated with matching key')
  is(update1Version?.fork, 0, 'app version.fork is 0')
  ok(update1Version?.length > 0, `app version.length is non-zero (v${update1Version?.fork}.${update1Version?.length})`)

  comment('3. Create another file, restage, and reseed')

  const file2 = `${ts()}.txt`
  comment(`\tcreating another test file (${file2})`)
  writeFileSync(path.join(dir, file2), 'test')

  comment('\trestaging')
  const update2Promise = await inspector.evaluate(awaitUpdate, { returnByValue: false })
  await helper.sink(helper.stage(stageOpts(testId), { close: false }))

  unlinkSync(path.join(dir, file2))

  comment('\treseeding')
  const seed3 = helper.pickMany(helper.seed(seedOpts(testId), { close: false }), [{ tag: 'key' }, { tag: 'announced' }])
  const seed3Key = await seed3.key
  const seed3Announced = seed3.announced
  ok(seed3Key, `reseeded platform key (${seed3Key})`)
  ok(seed3Announced, 'reseed announced')

  comment('waiting for update')
  const update2 = await inspector.awaitPromise(update2Promise.objectId)
  const update2Version = update2?.value?.version
  is(z32.encode(Buffer.from(update2Version?.key, 'hex')), key, 'app updated with matching key')
  is(update2Version?.fork, 0, 'app version.fork is 0')
  ok(update2Version?.length > update1Version?.length, `app version.length incremented (v${update2Version?.fork}.${update2Version?.length})`)

  await inspector.evaluate('global.__PEAR_TEST__.inspector.disable()')

  await inspector.close()
  await helper.close()

  const { code } = await pick.exit
  is(code, 0, 'exit code is 0')
})
