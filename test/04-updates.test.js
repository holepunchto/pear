'use strict'

const test = require('brittle')
const Helper = require('./helper')
const path = require('bare-path')
const os = require('bare-os')
const { writeFileSync, unlinkSync } = require('bare-fs')
const hie = require('hypercore-id-encoding')

const seedOpts = (id) => ({
  channel: `test-${id}`, name: `test-${id}`, key: null, dir, clientArgv: [], id: Math.floor(Math.random() * 10000)
})
const stageOpts = (id) => ({ ...seedOpts(id), dryRun: false, bare: true, ignore: [] })
const releaseOpts = (id, key) => ({
  id: Math.floor(Math.random() * 10000), channel: `test-${id}`, name: `test-${id}`, key
})
const ts = () => new Date().toISOString().replace(/[:.]/g, '-')
const dir = path.join(os.cwd(), 'fixtures', 'terminal')

test('Pear.updates(listener) should notify when restaging and releasing application (same pear instance)', async function ({ ok, is, plan, timeout, comment, teardown }) {
  plan(9)
  timeout(180000)
  teardown(async () => {
    const shutdowner = new Helper()
    await shutdowner.shutdown()
  })
  const testId = Math.floor(Math.random() * 100000)

  const stager1 = new Helper()
  await stager1.ready()

  comment('1. Stage and run app')

  comment('\tstaging')
  const staging = stager1.stage(stageOpts(testId))
  const until = await Helper.pick(staging, [{ tag: 'staging' }, { tag: 'final' }])
  const { key } = await until.staging
  await until.final

  comment('\trunning')
  const running = await Helper.open(key, { tags: ['exit'] })
  const update1Promise = await running.inspector.evaluate('new Promise((resolve) => Pear.updates().once("data", resolve))', { returnByValue: false })
  const update1ActualPromise = running.inspector.awaitPromise(update1Promise.objectId)
  const update2LazyPromise = update1ActualPromise.then(() => running.inspector.evaluate('new Promise((resolve) => Pear.updates().once("data", resolve))', { returnByValue: false }))

  comment('2. Create new file, restage, and reseed')

  const file1 = `${ts()}.txt`
  comment(`\tcreating test file (${file1})`)
  writeFileSync(path.join(dir, file1), 'test')

  comment('\tstaging')
  const stager2 = new Helper()
  await stager2.ready()

  await Helper.pick(stager2.stage(stageOpts(testId)), { tag: 'final' })

  unlinkSync(path.join(dir, file1))

  const update1 = await update1ActualPromise
  const update1Version = update1?.value?.version
  is(hie.encode(hie.decode(update1Version?.key)).toString('hex'), hie.encode(hie.decode(key)).toString('hex'), 'app updated with matching key')
  is(update1Version?.fork, 0, 'app version.fork is 0')
  ok(update1Version?.length > 0, `app version.length is non-zero (v${update1Version?.fork}.${update1Version?.length})`)

  comment('releasing')
  const update2Promise = await update2LazyPromise
  const update2ActualPromise = running.inspector.awaitPromise(update2Promise.objectId)
  const releaser = new Helper()
  await releaser.ready()
  const releasing = releaser.release(releaseOpts(testId, key))

  await Helper.pick(releasing, { tag: 'released' })

  comment('waiting for update')
  const update2 = await update2ActualPromise
  const update2Version = update2?.value?.version
  is(hie.encode(hie.decode(update2Version?.key)).toString('hex'), hie.encode(hie.decode(key)).toString('hex'), 'app updated with matching key')
  is(update2Version?.fork, 0, 'app version.fork is 0')
  ok(update2Version?.length > update1Version?.length, `app version.length incremented (v${update2Version?.fork}.${update2Version?.length})`)

  await running.inspector.close()
  const { code } = await running.until.exit
  is(code, 0, 'exit code is 0')
})

test('Pear.updates(listener) should notify twice when restaging application twice (same pear instance)', async function (t) {
  const { teardown, ok, is, plan, timeout, comment } = t

  plan(13)
  timeout(180000)

  const testId = Math.floor(Math.random() * 100000)

  const helper = new Helper(teardown)
  await helper.ready()

  const dir = path.join(os.cwd(), 'fixtures', 'terminal')

  comment('1. Stage  and run app')

  comment('\tstaging')
  await Helper.sink(helper.stage(stageOpts(testId)))

  comment('\tstaging')
  const stager = new Helper()
  await stager.ready()
  const staging = stager.stage(stageOpts(testId))
  const until = await Helper.pick(staging, [{ tag: 'staging' }, { tag: 'final' }])
  const { key } = await until.staging
  await until.final

  comment('\trunning')
  const running = await Helper.open(key, { tags: ['exit'] })

  comment('2. Create new file, restage, and reseed')

  const file1 = `${ts()}.txt`
  comment(`\tcreating test file (${file1})`)
  writeFileSync(path.join(dir, file1), 'test')

  comment('\tstaging')
  const update1Promise = await running.inspector.evaluate('new Promise((resolve) => Pear.updates().once("data", resolve))', { returnByValue: false })
  await Helper.sink(helper.stage(stageOpts(testId)))

  unlinkSync(path.join(dir, file1))

  comment('\tseeding')
  const seed2 = await Helper.pick(helper.seed(seedOpts(testId)), [{ tag: 'key' }, { tag: 'announced' }])
  const seed2Key = await seed2.key
  const seed2Announced = seed2.announced
  ok(seed2Key, `reseeded platform key (${seed2Key})`)
  ok(seed2Announced, 'reseed announced')

  const update1 = await running.inspector.awaitPromise(update1Promise.objectId)
  const update1Version = update1?.value?.version
  is(hie.encode(hie.decode(update1Version?.key)).toString('hex'), hie.encode(hie.decode(key)).toString('hex'), 'app updated with matching key')
  is(update1Version?.fork, 0, 'app version.fork is 0')
  ok(update1Version?.length > 0, `app version.length is non-zero (v${update1Version?.fork}.${update1Version?.length})`)

  comment('3. Create another file, restage, and reseed')

  const file2 = `${ts()}.txt`
  comment(`\tcreating another test file (${file2})`)
  writeFileSync(path.join(dir, file2), 'test')

  comment('\trestaging')
  const update2Promise = await running.inspector.evaluate('new Promise((resolve) => Pear.updates().once("data", resolve))', { returnByValue: false })
  await Helper.sink(helper.stage(stageOpts(testId)))

  unlinkSync(path.join(dir, file2))

  comment('\treseeding')
  const seed3 = await Helper.pick(helper.seed(seedOpts(testId)), [{ tag: 'key' }, { tag: 'announced' }])
  const seed3Key = await seed3.key
  const seed3Announced = seed3.announced
  ok(seed3Key, `reseeded platform key (${seed3Key})`)
  ok(seed3Announced, 'reseed announced')

  comment('waiting for update')
  const update2 = await running.inspector.awaitPromise(update2Promise.objectId)
  const update2Version = update2?.value?.version
  is(hie.encode(hie.decode(update2Version?.key)).toString('hex'), hie.encode(hie.decode(key)).toString('hex'), 'app updated with matching key')
  is(update2Version?.fork, 0, 'app version.fork is 0')
  ok(update2Version?.length > update1Version?.length, `app version.length incremented (v${update2Version?.fork}.${update2Version?.length})`)

  await running.inspector.close()
  await helper._close()

  const { code } = await running.until.exit
  is(code, 0, 'exit code is 0')
})
