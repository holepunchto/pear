const test = require('brittle')
const path = require('bare-path')
const os = require('bare-os')
const fs = require('bare-fs')
const hypercoreid = require('hypercore-id-encoding')
const Helper = require('./helper')

const harness = path.join(Helper.root, 'test', 'fixtures', 'harness')
const seedOpts = (id, dir = harness) => ({ channel: `test-${id}`, name: `test-${id}`, key: null, dir, cmdArgs: [] })
const stageOpts = (id, dir) => ({ ...seedOpts(id, dir), dryRun: false, bare: true, ignore: [] })
const releaseOpts = (id, key) => ({ channel: `test-${id}`, name: `test-${id}`, key })
const ts = () => new Date().toISOString().replace(/[:.]/g, '-')
const tmp = fs.realpathSync(os.tmpdir())

class Rig {
  setup = async ({ comment, timeout }) => {
    timeout(180000)
    const helper = new Helper()
    this.helper = helper
    comment('connecting local sidecar')
    await helper.ready()
    comment('local sidecar connected')
    const id = Math.floor(Math.random() * 10000)
    comment('staging platform...')
    const staging = helper.stage({ channel: `test-${id}`, name: `test-${id}`, dir: Helper.root, dryRun: false, bare: true })
    await Helper.pick(staging, { tag: 'final' })
    comment('platform staged')
    comment('seeding platform...')
    const seeding = await helper.seed({ channel: `test-${id}`, name: `test-${id}`, dir: Helper.root, key: null, cmdArgs: [] })
    const until = await Helper.pick(seeding, [{ tag: 'key' }, { tag: 'announced' }])
    const key = await until.key
    await until.announced
    comment('platform seeding')
    comment('bootstrapping tmp platform...')
    const platformDir = path.join(tmp, 'tmp-pear')
    this.platformDir = platformDir
    await Helper.bootstrap(key, platformDir)
    comment('tmp platform bootstrapped')
    global.Pear.teardown(async () => Helper.gc(platformDir))
  }

  cleanup = async ({ comment }) => {
    comment('closing helper client')
    await this.helper.close()
    comment('helper client closed')
  }
}

const rig = new Rig()

test.hook('updates setup', rig.setup)

test('Pear.updates(listener) should notify when restaging and releasing application (same pear instance)', async function ({ ok, is, plan, comment, teardown, timeout }) {
  timeout(180000)
  plan(7)

  const testId = Math.floor(Math.random() * 100000)
  const stager1 = new Helper(rig)
  teardown(() => stager1.close())
  await stager1.ready()

  comment('1. Stage and run app')

  comment('\tstaging')
  const staging = stager1.stage(stageOpts(testId))
  const until = await Helper.pick(staging, [{ tag: 'staging' }, { tag: 'final' }])
  const { key, link } = await until.staging
  await until.final

  comment('\trunning')
  const running = await Helper.open(link, { tags: ['exit'] }, rig)
  const update1Promise = await running.inspector.evaluate('__PEAR_TEST__.nextUpdate()', { returnByValue: false })
  const update1ActualPromise = running.inspector.awaitPromise(update1Promise.objectId)
  const update2LazyPromise = update1ActualPromise.then(() => running.inspector.evaluate('__PEAR_TEST__.nextUpdate()', { returnByValue: false }))

  comment('2. Create new file, restage, and reseed')

  const file = `${ts()}.tmp`
  comment(`\tcreating test file (${file})`)
  fs.writeFileSync(path.join(harness, file), 'test')
  teardown(() => { try { fs.unlinkSync(path.join(harness, file)) } catch { /* ignore */ } })
  comment('\tstaging')
  const stager2 = new Helper(rig)
  teardown(() => stager2.close())
  await stager2.ready()

  await Helper.pick(stager2.stage(stageOpts(testId)), { tag: 'final' })

  fs.unlinkSync(path.join(harness, file))

  const update1 = await update1ActualPromise
  const update1Version = update1?.value?.version
  is(hypercoreid.normalize(update1Version?.key), hypercoreid.normalize(key), 'app updated with matching key')
  is(update1Version?.fork, 0, 'app version.fork is 0')
  ok(update1Version?.length > 0, `app version.length is non-zero (v${update1Version?.fork}.${update1Version?.length})`)

  comment('releasing')
  const update2Promise = await update2LazyPromise
  const update2ActualPromise = running.inspector.awaitPromise(update2Promise.objectId)
  const releaser = new Helper(rig)
  teardown(() => releaser.close())
  await releaser.ready()

  const releasing = releaser.release(releaseOpts(testId, key))
  await Helper.pick(releasing, { tag: 'released' })
  teardown(() => releaser.close()) // TODO why is this needed?
  comment('waiting for update')
  const update2 = await update2ActualPromise
  const update2Version = update2?.value?.version
  is(hypercoreid.normalize(update2Version?.key), hypercoreid.normalize(key), 'app updated with matching key')
  is(update2Version?.fork, 0, 'app version.fork is 0')
  ok(update2Version?.length > update1Version?.length, `app version.length incremented (v${update2Version?.fork}.${update2Version?.length})`)
  await running.inspector.evaluate('__PEAR_TEST__.close()')
  await running.inspector.close()
  const { code } = await running.until.exit
  is(code, 0, 'exit code is 0')
})

test('Pear.updates(listener) should notify twice when restaging application twice (same pear instance)', async function (t) {
  const { ok, is, plan, comment, timeout, teardown } = t

  timeout(180000)
  plan(7)

  const testId = Math.floor(Math.random() * 100000)

  comment('1. Stage and run app')

  comment('\tstaging')
  const stager1 = new Helper(rig)
  teardown(() => stager1.close())
  await stager1.ready()
  const staging = stager1.stage(stageOpts(testId))
  const until = await Helper.pick(staging, [{ tag: 'staging' }, { tag: 'final' }])
  const { key, link } = await until.staging
  await until.final

  comment('\trunning')
  const running = await Helper.open(link, { tags: ['exit'] }, rig)
  const update1Promise = await running.inspector.evaluate('__PEAR_TEST__.nextUpdate()', { returnByValue: false })
  const update1ActualPromise = running.inspector.awaitPromise(update1Promise.objectId)
  const update2LazyPromise = update1ActualPromise.then(() => running.inspector.evaluate(`
    new Promise((resolve) =>  __PEAR_TEST__.sub.once("data", resolve))
  `, { returnByValue: false }))

  comment('2. Create new file, restage, and reseed')

  const file = `${ts()}.tmp`
  comment(`\tcreating test file (${file})`)
  fs.writeFileSync(path.join(harness, file), 'test')

  comment('\trestaging')
  const stager2 = new Helper(rig)
  teardown(() => stager2.close())
  await stager2.ready()
  await Helper.pick(stager2.stage(stageOpts(testId)), { tag: 'final' })

  fs.unlinkSync(path.join(harness, file))

  comment('\twaiting for update')
  const update1 = await update1ActualPromise
  const update1Version = update1?.value?.version
  is(hypercoreid.normalize(update1Version?.key), hypercoreid.normalize(key), 'app updated with matching key')
  is(update1Version?.fork, 0, 'app version.fork is 0')
  ok(update1Version?.length > 0, `app version.length is non-zero (v${update1Version?.fork}.${update1Version?.length})`)

  comment('3. Create another file and restage')

  const file2 = `${ts()}.tmp`
  comment(`\tcreating another test file (${file2})`)
  fs.writeFileSync(path.join(harness, file2), 'test')

  comment('\trestaging')
  const update2Promise = await update2LazyPromise
  const update2ActualPromise = running.inspector.awaitPromise(update2Promise.objectId)

  const stager3 = new Helper(rig)
  teardown(() => stager3.close())
  await stager3.ready()
  await Helper.pick(stager3.stage(stageOpts(testId)), { tag: 'final' })

  fs.unlinkSync(path.join(harness, file2))

  comment('\twaiting for update')
  const update2 = await update2ActualPromise
  const update2Version = update2?.value?.version
  is(hypercoreid.normalize(update2Version?.key), hypercoreid.normalize(key), 'app updated with matching key')
  is(update2Version?.fork, 0, 'app version.fork is 0')
  ok(update2Version?.length > update1Version?.length, `app version.length incremented (v${update2Version?.fork}.${update2Version?.length})`)

  await running.inspector.evaluate('__PEAR_TEST__.close()')
  await running.inspector.close()
  const { code } = await running.until.exit
  is(code, 0, 'exit code is 0')
})

test('Pear.updates should notify Platform stage updates (different pear instances)', async function (t) {
  const { ok, is, plan, timeout, comment, teardown } = t
  plan(10)
  timeout(180000)
  const appStager = new Helper(rig)
  teardown(() => appStager.close())
  await appStager.ready()

  const pid = Math.floor(Math.random() * 10000)
  const fid = 'fixture'
  const appDir = path.join(Helper.root, 'test', 'fixtures', 'harness')

  comment('staging app')
  const appStaging = appStager.stage({ channel: `test-${fid}`, name: `test-${fid}`, dir: appDir, dryRun: false, bare: true })
  const appFinal = await Helper.pick(appStaging, { tag: 'final' })
  ok(appFinal.success, 'stage succeeded')

  comment('seeding app')
  const appSeeder = new Helper(rig)
  teardown(() => appSeeder.close())
  teardown(() => appSeeder.close())
  await appSeeder.ready()
  const appSeeding = appSeeder.seed({ channel: `test-${fid}`, name: `test-${fid}`, dir: appDir, key: null, cmdArgs: [] })
  const untilApp = await Helper.pick(appSeeding, [{ tag: 'key' }, { tag: 'announced' }])

  const appKey = await untilApp.key
  const appAnnounced = await untilApp.announced

  ok(hypercoreid.isValid(appKey), 'app key is valid')
  ok(appAnnounced, 'seeding is announced')

  comment('staging tmp platform')
  const stager = new Helper(rig)
  teardown(() => stager.close())
  await stager.ready()
  const staging = stager.stage({ channel: `test-${pid}`, name: `test-${pid}`, dir: Helper.root, dryRun: false, bare: true })
  const final = await Helper.pick(staging, { tag: 'final' })
  ok(final.success, 'stage succeeded')

  comment('seeding tmp platform')
  const seeder = new Helper(rig)
  teardown(() => seeder.close())
  teardown(() => seeder.close())
  await seeder.ready()
  const seeding = seeder.seed({ channel: `test-${pid}`, name: `test-${pid}`, dir: Helper.root, key: null, cmdArgs: [] })
  const until = await Helper.pick(seeding, [{ tag: 'key' }, { tag: 'announced' }])

  const key = await until.key
  ok(hypercoreid.isValid(key), 'platform key is valid')

  const announced = await until.announced
  ok(announced, 'seeding is announced')

  t.comment('bootstrapping rcv platform...')
  const platformDirRcv = path.join(tmp, 'rcv-pear')
  await Helper.bootstrap(key, platformDirRcv)
  const prefs = 'preferences.json'
  fs.writeFileSync(path.join(platformDirRcv, prefs), JSON.stringify({ trusted: [appKey] }))
  teardown(() => { fs.unlinkSync(path.join(platformDirRcv, prefs)) }, { order: -Infinity })
  comment('rcv platform bootstrapped')
  const rcv = new Helper({ platformDir: platformDirRcv })

  comment('connecting rcv sidecar...')
  await rcv.ready()
  comment('rcv sidecar connected')
  teardown(async () => {
    comment('rcv sidecar shutting down..')
    await rcv.shutdown()
    comment('rcv sidecar shutdown')
  })

  comment('running app from rcv platform')
  const link = 'pear://' + appKey
  const running = await Helper.open(link, { tags: ['exit'] }, { platformDir: platformDirRcv })
  const { value } = await running.inspector.evaluate('Pear.versions()', { awaitPromise: true })
  const { key: pearVersionKey, length: pearVersionLength } = value?.platform || {}
  is(pearVersionKey, key, 'platform version key matches staged key')

  const updatePromise = await running.inspector.evaluate('__PEAR_TEST__.nextUpdate()', { returnByValue: false })
  const updateActualPromise = running.inspector.awaitPromise(updatePromise.objectId)

  const ts = () => new Date().toISOString().replace(/[:.]/g, '-')
  const file = `${ts()}.tmp`
  comment(`creating platform test file (${file})`)
  fs.writeFileSync(path.join(Helper.root, file), 'test')
  teardown(() => { try { fs.unlinkSync(path.join(Helper.root, file)) } catch { /* ignore */ } }, { order: -Infinity })

  comment('restaging tmp platform')
  const stager2 = new Helper(rig)
  teardown(() => stager2.close())
  await stager2.ready()
  const staging2 = stager2.stage({ channel: `test-${pid}`, name: `test-${pid}`, dir: Helper.root, dryRun: false, bare: true })
  const final2 = await Helper.pick(staging2, { tag: 'final' })
  ok(final2.success, 'stage succeeded')

  const update = await updateActualPromise
  const updateVersion = update?.value?.version
  const pearUpdateLength = updateVersion.length
  ok(pearUpdateLength > pearVersionLength, `platform version.length incremented (v${updateVersion?.fork}.${updateVersion?.length})`)

  await running.inspector.evaluate('__PEAR_TEST__.close()')
  await running.inspector.close()
  const { code } = await running.until.exit
  is(code, 0, 'exit code is 0')
})

test('Pear.updates should notify Platform stage, Platform release updates (different pear instances)', async function (t) {
  const { ok, is, plan, timeout, comment, teardown } = t
  plan(12)
  timeout(180000)

  const appStager = new Helper(rig)
  teardown(() => appStager.close())
  await appStager.ready()

  const pid = Math.floor(Math.random() * 10000)
  const fid = 'fixture'
  const appDir = path.join(Helper.root, 'test', 'fixtures', 'harness')

  comment('staging app')
  const appStaging = appStager.stage({ channel: `test-${fid}`, name: `test-${fid}`, dir: appDir, dryRun: false, bare: true })
  const appFinal = await Helper.pick(appStaging, { tag: 'final' })
  ok(appFinal.success, 'stage succeeded')

  comment('seeding app')
  const appSeeder = new Helper(rig)
  teardown(() => appSeeder.close())

  await appSeeder.ready()
  const appSeeding = appSeeder.seed({ channel: `test-${fid}`, name: `test-${fid}`, dir: appDir, key: null, cmdArgs: [] })
  const untilApp = await Helper.pick(appSeeding, [{ tag: 'key' }, { tag: 'announced' }])

  const appKey = await untilApp.key
  const appAnnounced = await untilApp.announced

  ok(hypercoreid.isValid(appKey), 'app key is valid')
  ok(appAnnounced, 'seeding is announced')

  comment('staging tmp platform')
  const stager = new Helper(rig)
  teardown(() => stager.close())
  await stager.ready()
  const staging = stager.stage({ channel: `test-${pid}`, name: `test-${pid}`, dir: Helper.root, dryRun: false, bare: true })
  const final = await Helper.pick(staging, { tag: 'final' })
  ok(final.success, 'stage succeeded')

  comment('seeding tmp platform')
  const seeder = new Helper(rig)
  teardown(() => seeder.close())
  await seeder.ready()
  const seeding = seeder.seed({ channel: `test-${pid}`, name: `test-${pid}`, dir: Helper.root, key: null, cmdArgs: [] })
  const until = await Helper.pick(seeding, [{ tag: 'key' }, { tag: 'announced' }])

  const key = await until.key
  ok(hypercoreid.isValid(key), 'platform key is valid')

  const announced = await until.announced
  ok(announced, 'seeding is announced')

  comment('bootstrapping rcv platform...')
  const platformDirRcv = path.join(tmp, 'rcv-pear')
  await Helper.bootstrap(key, platformDirRcv)
  const prefs = 'preferences.json'
  fs.writeFileSync(path.join(platformDirRcv, prefs), JSON.stringify({ trusted: [appKey] }))
  teardown(() => { fs.unlinkSync(path.join(platformDirRcv, prefs)) }, { order: -Infinity })
  comment('rcv platform bootstrapped')

  comment('running app from rcv platform')
  const link = 'pear://' + appKey
  const running = await Helper.open(link, { tags: ['exit'] }, { platformDir: platformDirRcv })
  const { value } = await running.inspector.evaluate('Pear.versions()', { awaitPromise: true })
  const { key: pearVersionKey, length: pearVersionLength } = value?.platform || {}
  is(pearVersionKey, key, 'platform version key matches staged key')

  const update1Promise = await running.inspector.evaluate('__PEAR_TEST__.nextUpdate()', { returnByValue: false })
  const update1ActualPromise = running.inspector.awaitPromise(update1Promise.objectId)
  const update2LazyPromise = update1ActualPromise.then(() => running.inspector.evaluate('__PEAR_TEST__.nextUpdate()', { returnByValue: false }))

  const ts = () => new Date().toISOString().replace(/[:.]/g, '-')
  const file = `${ts()}.tmp`
  comment(`creating platform test file (${file})`)
  fs.writeFileSync(path.join(Helper.root, file), 'test')
  teardown(() => { fs.unlinkSync(path.join(Helper.root, file)) }, { order: -Infinity })

  comment('restaging tmp platform')
  const stager2 = new Helper(rig)
  teardown(() => stager2.close())
  await stager2.ready()
  const staging2 = stager2.stage({ channel: `test-${pid}`, name: `test-${pid}`, dir: Helper.root, dryRun: false, bare: true })
  const final2 = await Helper.pick(staging2, { tag: 'final' })
  ok(final2.success, 'stage succeeded')

  const update1 = await update1ActualPromise
  const update1Version = update1?.value?.version
  const pearUpdateLength = update1Version.length
  ok(pearUpdateLength > pearVersionLength, `platform version.length incremented (v${update1Version?.fork}.${update1Version?.length})`)

  comment('releasing tmp platform')
  const update2Promise = await update2LazyPromise
  const update2ActualPromise = running.inspector.awaitPromise(update2Promise.objectId)
  const releaser = new Helper(rig)
  teardown(() => releaser.close())
  await releaser.ready()
  const releasing = releaser.release({ channel: `test-${pid}`, name: `test-${pid}`, key })
  await Helper.pick(releasing, { tag: 'released' })
  teardown(() => releaser.close()) // TODO why is this needed?
  comment('waiting for platform update notification')
  const update2 = await update2ActualPromise
  const update2Version = update2?.value?.version
  const pearUpdate2Key = update2Version.key
  const pearUpdate2Length = update2Version.length

  is(pearUpdate2Key, key, 'platform release update matches staging key')
  ok(pearUpdate2Length > pearUpdateLength, `platform version length incremented (v${update2Version?.fork}.${update2Version?.length})`)

  await running.inspector.evaluate('__PEAR_TEST__.close()')
  await running.inspector.close()
  const { code } = await running.until.exit
  is(code, 0, 'exit code is 0')
})

test.hook('updates cleanup', rig.cleanup)
