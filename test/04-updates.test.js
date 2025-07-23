'use strict'
const test = require('brittle')
const path = require('bare-path')
const fs = require('bare-fs')
const hypercoreid = require('hypercore-id-encoding')
const Helper = require('./helper')
const updates = path.join(Helper.localDir, 'test', 'fixtures', 'updates')
const seedOpts = (id) => ({ channel: `test-${id}`, name: `test-${id}`, key: null, dir: updates, cmdArgs: [] })
const stageOpts = (id, dir) => ({ ...seedOpts(id, dir), dryRun: false, ignore: [] })
const releaseOpts = (id, key) => ({ channel: `test-${id}`, name: `test-${id}`, key })
const ts = () => new Date().toISOString().replace(/[:.]/g, '-')
const rig = new Helper.Rig()
const { tmp } = rig

const PLATFORM_STAGE_TIMEOUT = 30_000

test.hook('updates setup', rig.setup)

test('Pear.updates(listener) should notify when restaging and releasing application (same pear instance)', async function ({ ok, is, plan, comment, teardown, timeout }) {
  plan(7)

  const testId = Helper.getRandomId()
  const stager1 = new Helper(rig)
  teardown(() => stager1.close(), { order: Infinity })
  await stager1.ready()

  comment('1. Stage and run app')

  comment('\tstaging')
  const staging = stager1.stage(stageOpts(testId))
  teardown(() => Helper.teardownStream(staging))
  const until = await Helper.pick(staging, [{ tag: 'staging' }, { tag: 'final' }])
  const { key, link } = await until.staging
  await until.final

  comment('\trunning')
  const { pipe } = await Helper.run({ link })
  const versions = await Helper.untilResult(pipe).then((data) => JSON.parse(data))
  ok(versions?.app, 'updater is ready')

  const untilUpdate1 = Helper.untilResult(pipe).then((data) => JSON.parse(data))
  const untilUpdate2 = untilUpdate1.then(() => Helper.untilResult(pipe)).then((data) => JSON.parse(data))

  comment('2. Create new file, restage, and reseed')

  const file = `${ts()}.tmp`
  comment(`\tcreating test file (${file})`)
  fs.writeFileSync(path.join(updates, file), 'test')
  teardown(() => { try { fs.unlinkSync(path.join(updates, file)) } catch { /* ignore */ } })

  comment('\tstaging')
  const stager2 = new Helper(rig)
  teardown(() => stager2.close(), { order: Infinity })
  await stager2.ready()

  const staging2 = stager2.stage(stageOpts(testId))
  teardown(() => Helper.teardownStream(staging2))
  await Helper.pick(staging2, { tag: 'final' })

  fs.unlinkSync(path.join(updates, file))

  const update1 = await untilUpdate1
  const update1Version = update1?.version
  is(hypercoreid.normalize(update1Version?.key), hypercoreid.normalize(key), 'app updated with matching key')
  is(update1Version?.fork, 0, 'app version.fork is 0')
  ok(update1Version?.length > 0, `app version.length is non-zero (v${update1Version?.fork}.${update1Version?.length})`)

  comment('\treleasing')
  const releaser = new Helper(rig)
  teardown(() => releaser.close(), { order: Infinity })
  await releaser.ready()

  const releasing = releaser.release(releaseOpts(testId, key))
  teardown(() => Helper.teardownStream(releasing))
  await Helper.pick(releasing, { tag: 'released' })

  comment('\twaiting for update')
  const update2 = await untilUpdate2
  const update2Version = update2?.version
  is(hypercoreid.normalize(update2Version?.key), hypercoreid.normalize(key), 'app updated with matching key')
  is(update2Version?.fork, 0, 'app version.fork is 0')
  ok(update2Version?.length > update1Version?.length, `app version.length incremented (v${update2Version?.fork}.${update2Version?.length})`)

  await Helper.untilClose(pipe)
})

test('Pear.updates(listener) should notify twice when restaging application twice (same pear instance)', async function (t) {
  const { ok, is, plan, comment, teardown } = t
  plan(7)

  const testId = Helper.getRandomId()

  comment('1. Stage and run app')

  comment('\tstaging')
  const stager1 = new Helper(rig)
  teardown(() => stager1.close(), { order: Infinity })
  await stager1.ready()
  const staging = stager1.stage(stageOpts(testId))
  teardown(() => Helper.teardownStream(staging))
  const until = await Helper.pick(staging, [{ tag: 'staging' }, { tag: 'final' }])
  const { key, link } = await until.staging
  await until.final

  comment('\trunning')
  const { pipe } = await Helper.run({ link })
  const versions = await Helper.untilResult(pipe).then((data) => JSON.parse(data))
  ok(versions?.app, 'updater is ready')

  const untilUpdate1 = Helper.untilResult(pipe).then((data) => JSON.parse(data))
  const untilUpdate2 = untilUpdate1.then(() => Helper.untilResult(pipe)).then((data) => JSON.parse(data))

  comment('2. Create new file, restage, and reseed')

  const file = `${ts()}.tmp`
  comment(`\tcreating test file (${file})`)
  fs.writeFileSync(path.join(updates, file), 'test')

  comment('\trestaging')
  const stager2 = new Helper(rig)
  teardown(() => stager2.close(), { order: Infinity })
  await stager2.ready()

  const staging2 = stager2.stage(stageOpts(testId))
  teardown(() => Helper.teardownStream(staging2))
  await Helper.pick(staging2, { tag: 'final' })
  fs.unlinkSync(path.join(updates, file))

  comment('\twaiting for update')
  const update1 = await untilUpdate1
  const update1Version = update1?.version
  is(hypercoreid.normalize(update1Version?.key), hypercoreid.normalize(key), 'app updated with matching key')
  is(update1Version?.fork, 0, 'app version.fork is 0')
  ok(update1Version?.length > 0, `app version.length is non-zero (v${update1Version?.fork}.${update1Version?.length})`)

  comment('3. Create another file and restage')

  const file2 = `${ts()}.tmp`
  comment(`\tcreating another test file (${file2})`)
  fs.writeFileSync(path.join(updates, file2), 'test')

  comment('\trestaging')
  const stager3 = new Helper(rig)
  teardown(() => stager3.close(), { order: Infinity })
  await stager3.ready()
  const staging3 = stager3.stage(stageOpts(testId))
  teardown(() => Helper.teardownStream(staging3))
  await Helper.pick(staging3, { tag: 'final' })

  fs.unlinkSync(path.join(updates, file2))

  comment('\twaiting for update')
  const update2 = await untilUpdate2
  const update2Version = update2?.version
  is(hypercoreid.normalize(update2Version?.key), hypercoreid.normalize(key), 'app updated with matching key')
  is(update2Version?.fork, 0, 'app version.fork is 0')
  ok(update2Version?.length > update1Version?.length, `app version.length incremented (v${update2Version?.fork}.${update2Version?.length})`)

  await Helper.untilClose(pipe)
})

test('Pear.updates should notify Platform stage updates (different pear instances)', async function (t) {
  const { ok, is, plan, timeout, comment, teardown } = t
  plan(7)
  timeout(60_000)

  const appStager = new Helper(rig)
  teardown(() => appStager.close(), { order: Infinity })
  await appStager.ready()

  const channel = 'test-fixture'

  comment('staging app')
  const appStaging = appStager.stage({ channel, name: channel, dir: updates, dryRun: false })
  teardown(() => Helper.teardownStream(appStaging))
  const appFinal = await Helper.pick(appStaging, { tag: 'final' })
  ok(appFinal.success, 'stage succeeded')

  comment('seeding app')
  const appSeeder = new Helper(rig)
  teardown(() => appSeeder.close(), { order: Infinity })
  await appSeeder.ready()

  const appSeeding = appSeeder.seed({ channel, name: channel, dir: updates, key: null, cmdArgs: [] })
  teardown(() => Helper.teardownStream(appSeeding))
  const untilApp = await Helper.pick(appSeeding, [{ tag: 'key' }, { tag: 'announced' }])

  const appKey = await untilApp.key
  const appAnnounced = await untilApp.announced

  ok(hypercoreid.isValid(appKey), 'app key is valid')
  ok(appAnnounced, 'seeding is announced')

  comment('bootstrapping rcv platform...')
  const platformDirRcv = path.join(tmp, 'rcv-pear')
  await Helper.bootstrap(rig.key, platformDirRcv)
  comment('rcv platform bootstrapped')

  comment('running app from rcv platform')
  const link = 'pear://' + appKey
  const { pipe } = await Helper.run({ link, platformDir: platformDirRcv })
  const versions = await Helper.untilResult(pipe).then((data) => JSON.parse(data))
  const { key: pearVersionKey, length: pearVersionLength } = versions?.platform || {}
  is(pearVersionKey, rig.key, 'platform version key matches staged key')

  const untilUpdating = Helper.untilResult(pipe, { timeout: PLATFORM_STAGE_TIMEOUT }).then((data) => JSON.parse(data))
  const untilUpdate = untilUpdating.then(() => Helper.untilResult(pipe, { timeout: PLATFORM_STAGE_TIMEOUT })).then((data) => JSON.parse(data))

  const ts = () => new Date().toISOString().replace(/[:.]/g, '-')
  const file = `${ts()}.tmp`
  comment(`creating platform test file (${file})`)
  fs.writeFileSync(path.join(rig.artefactDir, file), 'test')
  teardown(() => { try { fs.unlinkSync(path.join(rig.artefactDir, file)) } catch { /* ignore */ } }, { order: -Infinity })

  comment('restaging rig platform')
  const staging = rig.local.stage({ channel: `test-${rig.id}`, name: `test-${rig.id}`, dir: rig.artefactDir, dryRun: false })
  teardown(() => Helper.teardownStream(staging))
  await Helper.pick(staging, { tag: 'final' })
  comment('rig platform restaged')

  comment('waiting for updating')
  const updating = await untilUpdating
  ok(updating.updating, 'platform is updating')

  comment('waiting for update')
  const update = await untilUpdate
  const updateVersion = update?.version
  const pearUpdateLength = updateVersion.length
  ok(update.updated, 'platform has been updated')
  ok(pearUpdateLength > pearVersionLength, `platform version.length incremented (v${updateVersion?.fork}.${updateVersion?.length})`)

  const rcv = new Helper({ platformDir: platformDirRcv, expectSidecar: true })
  await rcv.ready()
  await rcv.shutdown()

  await Helper.untilClose(pipe)
})

test('Pear.updates should notify Platform stage, Platform release updates (different pear instances)', async function (t) {
  const { ok, is, plan, timeout, comment, teardown } = t
  plan(11)
  timeout(60_000)

  const appStager = new Helper(rig)
  teardown(() => appStager.close(), { order: Infinity })
  await appStager.ready()

  const channel = 'test-fixture'

  comment('staging app')
  const appStaging = appStager.stage({ channel, name: channel, dir: updates, dryRun: false })
  teardown(() => Helper.teardownStream(appStaging))
  const appFinal = await Helper.pick(appStaging, { tag: 'final' })
  ok(appFinal.success, 'stage succeeded')

  comment('seeding app')
  const appSeeder = new Helper(rig)
  teardown(() => appSeeder.close(), { order: Infinity })

  await appSeeder.ready()
  const appSeeding = appSeeder.seed({ channel, name: channel, dir: updates, key: null, cmdArgs: [] })
  teardown(() => Helper.teardownStream(appSeeding))
  const untilApp = await Helper.pick(appSeeding, [{ tag: 'key' }, { tag: 'announced' }])

  const appKey = await untilApp.key
  const appAnnounced = await untilApp.announced

  ok(hypercoreid.isValid(appKey), 'app key is valid')
  ok(appAnnounced, 'seeding is announced')

  comment('bootstrapping rcv platform...')
  const platformDirRcv = path.join(tmp, 'rcv-pear')
  await Helper.bootstrap(rig.key, platformDirRcv)
  comment('rcv platform bootstrapped')

  comment('running app from rcv platform')
  const link = 'pear://' + appKey
  const { pipe } = await Helper.run({ link, platformDir: platformDirRcv })
  const versions = await Helper.untilResult(pipe).then((data) => JSON.parse(data))
  const { key: pearVersionKey, length: pearVersionLength } = versions?.platform || {}
  is(pearVersionKey, rig.key, 'platform version key matches staged key')

  const untilUpdating1 = Helper.untilResult(pipe, { timeout: PLATFORM_STAGE_TIMEOUT }).then((data) => JSON.parse(data))
  const untilUpdate1 = untilUpdating1.then(() => Helper.untilResult(pipe, { timeout: PLATFORM_STAGE_TIMEOUT })).then((data) => JSON.parse(data))
  const untilUpdating2 = untilUpdate1.then(() => Helper.untilResult(pipe, { timeout: PLATFORM_STAGE_TIMEOUT })).then((data) => JSON.parse(data))
  const untilUpdate2 = untilUpdating2.then(() => Helper.untilResult(pipe, { timeout: PLATFORM_STAGE_TIMEOUT })).then((data) => JSON.parse(data))

  const ts = () => new Date().toISOString().replace(/[:.]/g, '-')
  const file = `${ts()}.tmp`
  comment(`creating platform test file (${file})`)
  fs.writeFileSync(path.join(rig.artefactDir, file), 'test')
  teardown(() => { fs.unlinkSync(path.join(rig.artefactDir, file)) }, { order: -Infinity })

  comment('restaging rig platform')
  const staging = rig.local.stage({ channel: `test-${rig.id}`, name: `test-${rig.id}`, dir: rig.artefactDir, dryRun: false })
  teardown(() => Helper.teardownStream(staging))
  await Helper.pick(staging, { tag: 'final' })
  comment('rig platform restaged')

  comment('waiting for platform updating notification')
  const updating1 = await untilUpdating2
  ok(updating1.updating, 'platform is updating')

  comment('waiting for update')
  const update1 = await untilUpdate1
  const update1Version = update1?.version
  const pearUpdateLength = update1Version.length
  ok(update1.updated, 'platform has been updated')
  ok(pearUpdateLength > pearVersionLength, `platform version.length incremented (v${update1Version?.fork}.${update1Version?.length})`)

  comment('releasing rig platform')
  const releasing = rig.local.release({ channel: `test-${rig.id}`, name: `test-${rig.id}`, dir: rig.artefactDir })
  teardown(() => Helper.teardownStream(releasing))
  await Helper.pick(releasing, { tag: 'final' })

  comment('waiting for platform updating notification')
  const updating2 = await untilUpdating2
  ok(updating2.updating, 'platform is updating')

  comment('waiting for platform update notification')
  const update2 = await untilUpdate2
  const update2Version = update2?.version
  const pearUpdate2Key = update2Version.key
  const pearUpdate2Length = update2Version.length

  is(pearUpdate2Key, rig.key, 'platform release update matches staging key')
  ok(update2.updated, 'platform has been updated')
  ok(pearUpdate2Length > pearUpdateLength, `platform version length incremented (v${update2Version?.fork}.${update2Version?.length})`)

  const rcv = new Helper({ platformDir: platformDirRcv, expectSidecar: true })
  await rcv.ready()
  await rcv.shutdown()

  await Helper.untilClose(pipe)
})

test('Pear.updates should notify App stage updates (different pear instances)', async function (t) {
  const { ok, is, plan, timeout, comment, teardown } = t
  plan(6)
  timeout(60_000)

  const appStager = new Helper(rig)
  teardown(() => appStager.close(), { order: Infinity })
  await appStager.ready()
  const channel = 'test-fixture'

  comment('staging app')
  const appStaging = appStager.stage({ channel, name: channel, dir: updates, dryRun: false })
  teardown(() => Helper.teardownStream(appStaging))
  const appFinal = await Helper.pick(appStaging, { tag: 'final' })
  ok(appFinal.success, 'stage succeeded')

  comment('seeding app')
  const appSeeder = new Helper(rig)
  teardown(() => appSeeder.close(), { order: Infinity })
  await appSeeder.ready()
  const appSeeding = appSeeder.seed({ channel, name: channel, dir: updates, key: null, cmdArgs: [] })
  teardown(() => Helper.teardownStream(appSeeding))
  const untilApp = await Helper.pick(appSeeding, [{ tag: 'key' }, { tag: 'announced' }])

  const appKey = await untilApp.key
  const appAnnounced = await untilApp.announced

  ok(hypercoreid.isValid(appKey), 'app key is valid')
  ok(appAnnounced, 'seeding is announced')

  comment('bootstrapping rcv platform...')
  const platformDirRcv = path.join(tmp, 'rcv-pear')
  await Helper.bootstrap(rig.key, platformDirRcv)
  comment('rcv platform bootstrapped')

  comment('running app from rcv platform')
  const link = 'pear://' + appKey
  const { pipe } = await Helper.run({ link, platformDir: platformDirRcv })
  const versions = await Helper.untilResult(pipe).then((data) => JSON.parse(data))
  const { key: appVersionKey, length: appVersionLength } = versions?.app || {}
  is(appVersionKey, appKey, 'app version key matches staged key')

  const untilUpdate = Helper.untilResult(pipe).then((data) => JSON.parse(data))

  const ts = () => new Date().toISOString().replace(/[:.]/g, '-')
  const file = `${ts()}.tmp`
  comment(`creating app test file (${file})`)
  fs.writeFileSync(path.join(updates, file), 'test')
  teardown(() => { fs.unlinkSync(path.join(updates, file)) }, { order: -Infinity })

  comment('restaging app')
  const appStager2 = new Helper(rig)
  teardown(() => appStager2.close(), { order: Infinity })
  await appStager2.ready()
  const appStaging2 = appStager2.stage({ channel, name: channel, dir: updates, dryRun: false })
  teardown(() => Helper.teardownStream(appStaging2))
  const appFinal2 = await Helper.pick(appStaging2, { tag: 'final' })
  ok(appFinal2.success, 'stage succeeded')

  const update = await untilUpdate
  const updateVersion = update?.version
  const appUpdateLength = updateVersion.length
  ok(appUpdateLength > appVersionLength, `app version.length incremented (v${updateVersion?.fork}.${updateVersion?.length})`)

  const rcv = new Helper({ platformDir: platformDirRcv, expectSidecar: true })
  await rcv.ready()
  await rcv.shutdown()

  await Helper.untilClose(pipe)
})

test('Pear.updates should notify App stage, App release updates (different pear instances)', async function (t) {
  const { ok, is, plan, timeout, comment, teardown } = t
  plan(8)
  timeout(60_000)

  const appStager = new Helper(rig)
  teardown(() => appStager.close(), { order: Infinity })
  await appStager.ready()

  const channel = 'test-fixture'

  comment('staging app')
  const appStaging = appStager.stage({ channel, name: channel, dir: updates, dryRun: false })
  teardown(() => Helper.teardownStream(appStaging))
  const appFinal = await Helper.pick(appStaging, { tag: 'final' })
  ok(appFinal.success, 'stage succeeded')

  comment('seeding app')
  const appSeeder = new Helper(rig)
  teardown(() => appSeeder.close(), { order: Infinity })
  await appSeeder.ready()
  const appSeeding = appSeeder.seed({ channel, name: channel, dir: updates, key: null, cmdArgs: [] })
  teardown(() => Helper.teardownStream(appSeeding))
  const untilApp = await Helper.pick(appSeeding, [{ tag: 'key' }, { tag: 'announced' }])

  const appKey = await untilApp.key
  const appAnnounced = await untilApp.announced

  ok(hypercoreid.isValid(appKey), 'app key is valid')
  ok(appAnnounced, 'seeding is announced')

  comment('bootstrapping rcv platform...')
  const platformDirRcv = path.join(tmp, 'rcv-pear')
  await Helper.bootstrap(rig.key, platformDirRcv)
  comment('rcv platform bootstrapped')

  comment('running app from rcv platform')
  const link = 'pear://' + appKey
  const { pipe } = await Helper.run({ link, platformDir: platformDirRcv })
  const versions = await Helper.untilResult(pipe).then((data) => JSON.parse(data))
  const { key: appVersionKey, length: appVersionLength } = versions?.app || {}
  is(appVersionKey, appKey, 'app version key matches staged key')

  const untilUpdate1 = Helper.untilResult(pipe).then((data) => JSON.parse(data))
  const untilUpdate2 = untilUpdate1.then(() => Helper.untilResult(pipe)).then((data) => JSON.parse(data))

  const ts = () => new Date().toISOString().replace(/[:.]/g, '-')
  const file = `${ts()}.tmp`
  comment(`creating app test file (${file})`)
  fs.writeFileSync(path.join(updates, file), 'test')
  teardown(() => { fs.unlinkSync(path.join(updates, file)) }, { order: -Infinity })

  comment('restaging app')
  const appStager2 = new Helper(rig)
  teardown(() => appStager2.close(), { order: Infinity })
  await appStager2.ready()
  const appStaging2 = appStager2.stage({ channel, name: channel, dir: updates, dryRun: false })
  teardown(() => Helper.teardownStream(appStaging2))
  const appFinal2 = await Helper.pick(appStaging2, { tag: 'final' })
  ok(appFinal2.success, 'stage succeeded')

  const update1 = await untilUpdate1
  const update1Version = update1?.version
  const appUpdateLength = update1Version.length
  ok(appUpdateLength > appVersionLength, `app version.length incremented (v${update1Version?.fork}.${update1Version?.length})`)

  comment('releasing app')
  const releaser = new Helper(rig)
  teardown(() => releaser.close(), { order: Infinity })
  await releaser.ready()

  const releasing = releaser.release({ channel, name: channel, key: appKey })
  teardown(() => Helper.teardownStream(releasing))
  await Helper.pick(releasing, { tag: 'released' })

  comment('waiting for app update notification')
  const update2 = await untilUpdate2
  const update2Version = update2?.version
  const appUpdate2Length = update2Version.length

  is(hypercoreid.normalize(update2Version?.key), hypercoreid.normalize(appKey), 'app release update matches staging key')
  ok(appUpdate2Length > appUpdateLength, `app version length incremented (v${update2Version?.fork}.${update2Version?.length})`)

  const rcv = new Helper({ platformDir: platformDirRcv, expectSidecar: true })
  await rcv.ready()
  await rcv.shutdown()

  await Helper.untilClose(pipe)
})

test.hook('updates cleanup', rig.cleanup)
