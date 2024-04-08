'use strict'

const test = require('brittle')
const Helper = require('./helper')
const path = require('bare-path')
const os = require('bare-os')
const fs = require('bare-fs')
const hie = require('hypercore-id-encoding')
const Localdrive = require('localdrive')

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
  plan(7)
  timeout(180000)

  const osTmpDir = await fs.promises.realpath(os.tmpdir())
  const localdev = path.join(os.cwd(), '..')
  const tmpLocaldev = path.join(osTmpDir, 'tmp-localdev')

  const gc = async (dir) => await fs.promises.rm(dir, { recursive: true })
  try { await gc(tmpLocaldev) } catch { }

  await fs.promises.mkdir(tmpLocaldev, { recursive: true })
  teardown(async () => { try { await gc(tmpLocaldev) } catch (err) { console.error(err) } }, { order: Infinity })

  comment('mirroring platform')
  const srcDrive = new Localdrive(localdev)
  const destDrive = new Localdrive(tmpLocaldev)
  const mirror = srcDrive.mirror(destDrive, {
    filter: (key) => {
      return !key.startsWith('.git')
    }
  })
  await mirror.done()
  teardown(async () => srcDrive.close())
  teardown(async () => destDrive.close())

  const platformDir = path.join(tmpLocaldev, 'pear')
  teardown(async () => {
    const shutdowner = new Helper()
    await shutdowner.ready()
    await shutdowner.shutdown()
  })
  const testId = Math.floor(Math.random() * 100000)

  const stager1 = new Helper({ platformDir })
  await stager1.ready()

  comment('1. Stage and run app')

  comment('\tstaging')
  const staging = stager1.stage(stageOpts(testId))
  const until = await Helper.pick(staging, [{ tag: 'staging' }, { tag: 'final' }])
  const { key } = await until.staging
  await until.final

  comment('\trunning')
  const running = await Helper.open(key, { tags: ['exit'] }, { platformDir })
  const update1Promise = await running.inspector.evaluate(`
    __PEAR_TEST__.sub = Pear.updates()
    new Promise((resolve) => __PEAR_TEST__.sub.once("data", resolve))
  `, { returnByValue: false })
  const update1ActualPromise = running.inspector.awaitPromise(update1Promise.objectId)
  const update2LazyPromise = update1ActualPromise.then(() => running.inspector.evaluate(`
    new Promise((resolve) =>  __PEAR_TEST__.sub.once("data", resolve))
  `, { returnByValue: false }))

  comment('2. Create new file, restage, and reseed')

  const file = `${ts()}.txt`
  comment(`\tcreating test file (${file})`)
  fs.writeFileSync(path.join(dir, file), 'test')
  comment('\tstaging')
  const stager2 = new Helper({ platformDir })
  await stager2.ready()

  await Helper.pick(stager2.stage(stageOpts(testId)), { tag: 'final' })

  fs.unlinkSync(path.join(dir, file))

  const update1 = await update1ActualPromise
  const update1Version = update1?.value?.version
  is(hie.encode(hie.decode(update1Version?.key)).toString('hex'), hie.encode(hie.decode(key)).toString('hex'), 'app updated with matching key')
  is(update1Version?.fork, 0, 'app version.fork is 0')
  ok(update1Version?.length > 0, `app version.length is non-zero (v${update1Version?.fork}.${update1Version?.length})`)

  comment('releasing')
  const update2Promise = await update2LazyPromise
  const update2ActualPromise = running.inspector.awaitPromise(update2Promise.objectId)
  const releaser = new Helper({ platformDir })
  await releaser.ready()
  teardown(async () => await releaser.shutdown())

  const releasing = releaser.release(releaseOpts(testId, key))
  await Helper.pick(releasing, { tag: 'released' })

  comment('waiting for update')
  const update2 = await update2ActualPromise
  const update2Version = update2?.value?.version
  is(hie.encode(hie.decode(update2Version?.key)).toString('hex'), hie.encode(hie.decode(key)).toString('hex'), 'app updated with matching key')
  is(update2Version?.fork, 0, 'app version.fork is 0')
  ok(update2Version?.length > update1Version?.length, `app version.length incremented (v${update2Version?.fork}.${update2Version?.length})`)
  await running.inspector.evaluate('__PEAR_TEST__.sub.destroy()')
  await running.inspector.close()
  const { code } = await running.until.exit
  is(code, 0, 'exit code is 0')
})

// test('Pear.updates(listener) should notify twice when restaging application twice (same pear instance)', async function (t) {
//   const { teardown, ok, is, plan, timeout, comment } = t

//   plan(13)
//   timeout(180000)

//   const testId = Math.floor(Math.random() * 100000)

//   const helper = new Helper(teardown)
//   await helper.ready()

//   const dir = path.join(os.cwd(), 'fixtures', 'terminal')

//   comment('1. Stage  and run app')

//   comment('\tstaging')
//   await Helper.sink(helper.stage(stageOpts(testId)))

//   comment('\tstaging')
//   const stager = new Helper()
//   await stager.ready()
//   const staging = stager.stage(stageOpts(testId))
//   const until = await Helper.pick(staging, [{ tag: 'staging' }, { tag: 'final' }])
//   const { key } = await until.staging
//   await until.final

//   comment('\trunning')
//   const running = await Helper.open(key, { tags: ['exit'] })

//   comment('2. Create new file, restage, and reseed')

//   const file = `${ts()}.txt`
//   comment(`\tcreating test file (${file})`)
//   writeFileSync(path.join(dir, file), 'test')

//   comment('\tstaging')
//   const update1Promise = await running.inspector.evaluate('new Promise((resolve) => Pear.updates().once("data", resolve))', { returnByValue: false })
//   await Helper.sink(helper.stage(stageOpts(testId)))

//   unlinkSync(path.join(dir, file))

//   comment('\tseeding')
//   const seed2 = await Helper.pick(helper.seed(seedOpts(testId)), [{ tag: 'key' }, { tag: 'announced' }])
//   const seed2Key = await seed2.key
//   const seed2Announced = seed2.announced
//   ok(seed2Key, `reseeded platform key (${seed2Key})`)
//   ok(seed2Announced, 'reseed announced')

//   const update1 = await running.inspector.awaitPromise(update1Promise.objectId)
//   const update1Version = update1?.value?.version
//   is(hie.encode(hie.decode(update1Version?.key)).toString('hex'), hie.encode(hie.decode(key)).toString('hex'), 'app updated with matching key')
//   is(update1Version?.fork, 0, 'app version.fork is 0')
//   ok(update1Version?.length > 0, `app version.length is non-zero (v${update1Version?.fork}.${update1Version?.length})`)

//   comment('3. Create another file, restage, and reseed')

//   const file2 = `${ts()}.txt`
//   comment(`\tcreating another test file (${file2})`)
//   writeFileSync(path.join(dir, file2), 'test')

//   comment('\trestaging')
//   const update2Promise = await running.inspector.evaluate('new Promise((resolve) => Pear.updates().once("data", resolve))', { returnByValue: false })
//   await Helper.sink(helper.stage(stageOpts(testId)))

//   unlinkSync(path.join(dir, file2))

//   comment('\treseeding')
//   const seed3 = await Helper.pick(helper.seed(seedOpts(testId)), [{ tag: 'key' }, { tag: 'announced' }])
//   const seed3Key = await seed3.key
//   const seed3Announced = seed3.announced
//   ok(seed3Key, `reseeded platform key (${seed3Key})`)
//   ok(seed3Announced, 'reseed announced')

//   comment('waiting for update')
//   const update2 = await running.inspector.awaitPromise(update2Promise.objectId)
//   const update2Version = update2?.value?.version
//   is(hie.encode(hie.decode(update2Version?.key)).toString('hex'), hie.encode(hie.decode(key)).toString('hex'), 'app updated with matching key')
//   is(update2Version?.fork, 0, 'app version.fork is 0')
//   ok(update2Version?.length > update1Version?.length, `app version.length incremented (v${update2Version?.fork}.${update2Version?.length})`)

//   await running.inspector.close()
//   await helper._close()

//   const { code } = await running.until.exit
//   is(code, 0, 'exit code is 0')
// })

test('Pear.updates should notify Platform updates (different pear instances)', async function (t) {
  const { ok, is, plan, timeout, comment, teardown } = t
  plan(12)
  timeout(180000)
  teardown(async () => {
    const shutdowner = new Helper()
    await shutdowner.ready()
    await shutdowner.shutdown()
  }, { order: Infinity })

  const localdev = path.join(os.cwd(), '..')
  const osTmpDir = await fs.promises.realpath(os.tmpdir())
  const tmpLocaldev = path.join(osTmpDir, 'tmp-localdev')
  const platformDir = path.join(tmpLocaldev, 'pear')
  const tmpPearDir = path.join(osTmpDir, 'tmp-pear')

  const gc = async (dir) => await fs.promises.rm(dir, { recursive: true })

  try { await gc(tmpLocaldev) } catch { }
  try { await gc(tmpPearDir) } catch { }

  teardown(async () => { await gc(tmpLocaldev) }, { order: Infinity })
  teardown(async () => { await gc(tmpPearDir) }, { order: Infinity })

  await fs.promises.mkdir(tmpLocaldev, { recursive: true })
  await fs.promises.mkdir(tmpPearDir, { recursive: true })

  comment('mirroring platform')
  const srcDrive = new Localdrive(localdev)
  const destDrive = new Localdrive(tmpLocaldev)
  const mirror = srcDrive.mirror(destDrive, {
    filter: (key) => {
      return !key.startsWith('.git')
    }
  })
  await mirror.done()
  teardown(async () => { await srcDrive.close() })
  teardown(async () => { await destDrive.close() })
  const appStager = new Helper({ platformDir })
  await appStager.ready()

  const pid = Math.floor(Math.random() * 10000)
  const fid = 'fixture'
  const appDir = path.join(tmpLocaldev, 'test', 'fixtures', 'terminal')

  comment('staging app')
  const appStaging = appStager.stage({ id: Math.floor(Math.random() * 10000), channel: `test-${fid}`, name: `test-${fid}`, dir: appDir, dryRun: false, bare: true })
  const appFinal = await Helper.pick(appStaging, { tag: 'final' })
  ok(appFinal.success, 'stage succeeded')

  comment('seeding app')
  const appSeeder = new Helper({ platformDir })

  await appSeeder.ready()
  const appSeeding = appSeeder.seed({ id: Math.floor(Math.random() * 10000), channel: `test-${fid}`, name: `test-${fid}`, dir: appDir, key: null, clientArgv: [] })
  const untilApp = await Helper.pick(appSeeding, [{ tag: 'key' }, { tag: 'announced' }])

  const appKey = await untilApp.key
  const appAnnounced = await untilApp.announced

  ok(appKey, 'app key is ok')
  ok(appAnnounced, 'seeding is announced')

  comment('staging platform A')
  const stager = new Helper({ platformDir })
  await stager.ready()
  const staging = stager.stage({ id: Math.floor(Math.random() * 10000), channel: `test-${pid}`, name: `test-${pid}`, dir: tmpLocaldev, dryRun: false, bare: true })
  const final = await Helper.pick(staging, { tag: 'final' })
  ok(final.success, 'stage succeeded')

  comment('seeding platform A')
  const seeder = new Helper({ platformDir })
  await seeder.ready()
  const seeding = seeder.seed({ id: Math.floor(Math.random() * 10000), channel: `test-${pid}`, name: `test-${pid}`, dir: tmpLocaldev, key: null, clientArgv: [] })
  const until = await Helper.pick(seeding, [{ tag: 'key' }, { tag: 'announced' }])

  const pearKey = await until.key
  const announced = await until.announced

  ok(pearKey, 'pear key is ok')
  ok(announced, 'seeding is announced')

  comment('bootstrapping platform B')
  await Helper.bootstrap(pearKey, tmpPearDir)

  comment('setting up trust preferences')
  const prefs = 'preferences.json'
  fs.writeFileSync(path.join(tmpPearDir, prefs), JSON.stringify({ trusted: [appKey] }))
  teardown(() => { fs.unlinkSync(path.join(tmpPearDir, prefs)) }, { order: -Infinity })

  comment('running app from platform B')
  const currentDir = path.join(tmpPearDir, 'current')
  const running = await Helper.open(appKey, { tags: ['exit'] }, { currentDir })
  const { value } = await running.inspector.evaluate('Pear.versions()', { awaitPromise: true })
  const { key: pearVersionKey, length: pearVersionLength } = value?.platform || {}
  is(pearVersionKey, pearKey, 'platform version key matches staged key')

  const update1Promise = await running.inspector.evaluate(`
    __PEAR_TEST__.sub = Pear.updates()
    new Promise((resolve) => __PEAR_TEST__.sub.once("data", resolve))
  `, { returnByValue: false })
  const update1ActualPromise = running.inspector.awaitPromise(update1Promise.objectId)
  const update2LazyPromise = update1ActualPromise.then(() => running.inspector.evaluate(`
    new Promise((resolve) =>  __PEAR_TEST__.sub.once("data", resolve))
  `, { returnByValue: false }))

  const ts = () => new Date().toISOString().replace(/[:.]/g, '-')
  const file = `${ts()}.txt`
  comment(`creating platform test file (${file})`)
  fs.writeFileSync(path.join(tmpLocaldev, file), 'test')
  teardown(() => { fs.unlinkSync(path.join(tmpLocaldev, file)) }, { order: -Infinity })

  comment('restaging platform A')
  const stager2 = new Helper({ platformDir })
  await stager2.ready()
  const staging2 = stager2.stage({ id: Math.floor(Math.random() * 10000), channel: `test-${pid}`, name: `test-${pid}`, dir: tmpLocaldev, dryRun: false, bare: true })
  const final2 = await Helper.pick(staging2, { tag: 'final' })
  ok(final2.success, 'stage succeeded')

  const update1 = await update1ActualPromise
  const update1Version = update1?.value?.version
  const pearUpdateLength = update1Version.length
  ok(pearUpdateLength > pearVersionLength, `platform version.length incremented (v${update1Version?.fork}.${update1Version?.length})`)

  comment('releasing platform A')
  const update2Promise = await update2LazyPromise
  const update2ActualPromise = running.inspector.awaitPromise(update2Promise.objectId)
  const releaser = new Helper({ platformDir })
  await releaser.ready()
  teardown(async () => { await releaser.shutdown() })

  const releasing = releaser.release({ id: Math.floor(Math.random() * 10000), channel: `test-${pid}`, name: `test-${pid}`, key: pearKey })
  await Helper.pick(releasing, { tag: 'released' })

  comment('waiting for platform update notification')
  const update2 = await update2ActualPromise
  const update2Version = update2?.value?.version
  const pearUpdate2Key = update2Version.key
  const pearUpdate2Length = update2Version.length

  is(pearUpdate2Key, pearKey, 'platform release update matches staging key')
  ok(pearUpdate2Length > pearUpdateLength, `platform version length incremented (v${update2Version?.fork}.${update2Version?.length})`)

  await running.inspector.evaluate('__PEAR_TEST__.sub.destroy()')
  await running.inspector.close()
  const { code } = await running.until.exit
  is(code, 0, 'exit code is 0')
})

test('Pear.updates should notify App updates (different pear instances)', async function (t) {
  const { ok, is, plan, timeout, comment, teardown } = t
  plan(12)
  timeout(180000)
  teardown(async () => {
    const shutdowner = new Helper()
    await shutdowner.ready()
    await shutdowner.shutdown()
  }, { order: Infinity })

  const localdev = path.join(os.cwd(), '..')
  const osTmpDir = await fs.promises.realpath(os.tmpdir())
  const tmpLocaldev = path.join(osTmpDir, 'tmp-localdev')
  const platformDir = path.join(tmpLocaldev, 'pear')
  const tmpPearDir = path.join(osTmpDir, 'tmp-pear')

  const gc = async (dir) => await fs.promises.rm(dir, { recursive: true })

  try { await gc(tmpLocaldev) } catch { }
  try { await gc(tmpPearDir) } catch { }

  await fs.promises.mkdir(tmpLocaldev, { recursive: true })
  await fs.promises.mkdir(tmpPearDir, { recursive: true })

  teardown(async () => { await gc(tmpLocaldev) }, { order: Infinity })
  teardown(async () => { await gc(tmpPearDir) }, { order: Infinity })

  comment('mirroring platform')
  const srcDrive = new Localdrive(localdev)
  const destDrive = new Localdrive(tmpLocaldev)
  const mirror = srcDrive.mirror(destDrive, {
    filter: (key) => {
      return !key.startsWith('.git')
    }
  })
  await mirror.done()
  teardown(async () => { srcDrive.close() })
  teardown(async () => { destDrive.close() })

  const appStager = new Helper({ platformDir })
  await appStager.ready()
  const pid = Math.floor(Math.random() * 10000)
  const fid = 'fixture'
  const appDir = path.join(tmpLocaldev, 'test', 'fixtures', 'terminal')

  comment('staging app')
  const appStaging = appStager.stage({ id: Math.floor(Math.random() * 10000), channel: `test-${fid}`, name: `test-${fid}`, dir: appDir, dryRun: false, bare: true })
  const appFinal = await Helper.pick(appStaging, { tag: 'final' })
  ok(appFinal.success, 'stage succeeded')

  comment('seeding app')
  const appSeeder = new Helper({ platformDir })
  await appSeeder.ready()
  const appSeeding = appSeeder.seed({ id: Math.floor(Math.random() * 10000), channel: `test-${fid}`, name: `test-${fid}`, dir: appDir, key: null, clientArgv: [] })
  const untilApp = await Helper.pick(appSeeding, [{ tag: 'key' }, { tag: 'announced' }])

  const appKey = await untilApp.key
  const appAnnounced = await untilApp.announced

  ok(appKey, 'app key is ok')
  ok(appAnnounced, 'seeding is announced')

  comment('staging platform A')
  const stager = new Helper({ platformDir })
  await stager.ready()
  const staging = stager.stage({ id: Math.floor(Math.random() * 10000), channel: `test-${pid}`, name: `test-${pid}`, dir: tmpLocaldev, dryRun: false, bare: true })
  const final = await Helper.pick(staging, { tag: 'final' })
  ok(final.success, 'stage succeeded')

  comment('seeding platform A')
  const seeder = new Helper({ platformDir })
  await seeder.ready()
  const seeding = seeder.seed({ id: Math.floor(Math.random() * 10000), channel: `test-${pid}`, name: `test-${pid}`, dir: tmpLocaldev, key: null, clientArgv: [] })
  const until = await Helper.pick(seeding, [{ tag: 'key' }, { tag: 'announced' }])

  const pearKey = await until.key
  const announced = await until.announced

  ok(pearKey, 'pear key is ok')
  ok(announced, 'seeding is announced')

  comment('bootstrapping platform B')
  await Helper.bootstrap(pearKey, tmpPearDir)

  comment('setting up trust preferences')
  const prefs = 'preferences.json'
  fs.writeFileSync(path.join(tmpPearDir, prefs), JSON.stringify({ trusted: [appKey] }))
  teardown(() => { fs.unlinkSync(path.join(tmpPearDir, prefs)) }, { order: -Infinity })

  comment('running app from platform B')
  const currentDir = path.join(tmpPearDir, 'current')
  const running = await Helper.open(appKey, { tags: ['exit'] }, { currentDir })
  const { value } = await running.inspector.evaluate('Pear.versions()', { awaitPromise: true })
  const { key: appVersionKey, length: appVersionLength } = value?.app || {}
  is(appVersionKey, appKey, 'app version key matches staged key')

  const update1Promise = await running.inspector.evaluate(`
    __PEAR_TEST__.sub = Pear.updates()
    new Promise((resolve) => __PEAR_TEST__.sub.once("data", resolve))
  `, { returnByValue: false })
  const update1ActualPromise = running.inspector.awaitPromise(update1Promise.objectId)
  const update2LazyPromise = update1ActualPromise.then(() => running.inspector.evaluate(`
    new Promise((resolve) =>  __PEAR_TEST__.sub.once("data", resolve))
  `, { returnByValue: false }))

  const ts = () => new Date().toISOString().replace(/[:.]/g, '-')
  const file = `${ts()}.txt`
  comment(`creating app test file (${file})`)
  fs.writeFileSync(path.join(appDir, file), 'test')
  teardown(() => { fs.unlinkSync(path.join(appDir, file)) }, { order: -Infinity })

  comment('restaging app')
  const appStager2 = new Helper({ platformDir, logging: true })
  await appStager2.ready()
  const appStaging2 = appStager2.stage({ id: Math.floor(Math.random() * 10000), channel: `test-${fid}`, name: `test-${fid}`, dir: appDir, dryRun: false, bare: true })
  const appFinal2 = await Helper.pick(appStaging2, { tag: 'final' })
  ok(appFinal2.success, 'stage succeeded')

  const update1 = await update1ActualPromise
  const update1Version = update1?.value?.version
  const appUpdateLength = update1Version.length
  ok(appUpdateLength > appVersionLength, `app version.length incremented (v${update1Version?.fork}.${update1Version?.length})`)

  comment('releasing app')
  const update2Promise = await update2LazyPromise
  const update2ActualPromise = running.inspector.awaitPromise(update2Promise.objectId)
  const releaser = new Helper({ platformDir })
  await releaser.ready()
  teardown(async () => { await releaser.shutdown() })

  const releasing = releaser.release({ id: Math.floor(Math.random() * 10000), channel: `test-${pid}`, name: `test-${pid}`, key: appKey })
  await Helper.pick(releasing, { tag: 'released' })

  comment('waiting for app update notification')
  const update2 = await update2ActualPromise
  const update2Version = update2?.value?.version
  const appUpdate2Length = update2Version.length

  is(hie.encode(hie.decode(update2Version?.key)).toString('hex'), hie.encode(hie.decode(appKey)).toString('hex'), 'app release update matches staging key')
  ok(appUpdate2Length > appUpdateLength, `app version length incremented (v${update2Version?.fork}.${update2Version?.length})`)

  await running.inspector.evaluate('__PEAR_TEST__.sub.destroy()')
  await running.inspector.close()
  const { code } = await running.until.exit
  is(code, 0, 'exit code is 0')
})
