'use strict'
const test = require('brittle')
const path = require('bare-path')
const fs = require('bare-fs')
const hypercoreid = require('hypercore-id-encoding')
const Localdrive = require('localdrive')
const Corestore = require('corestore')
const testTmp = require('test-tmp')
const { Session } = require('pear-inspect')
const Helper = require('./helper')
const seedOpts = (id) => ({
  channel: `test-${id}`,
  name: `test-${id}`,
  key: null,
  dir: Helper.fixture('updates'),
  cmdArgs: []
})
const stageOpts = (id, dir) => ({
  ...seedOpts(id, dir),
  dryRun: false,
  ignore: []
})
const releaseOpts = (id, key) => ({
  channel: `test-${id}`,
  name: `test-${id}`,
  key
})
const ts = () => new Date().toISOString().replace(/[:.]/g, '-')
const rig = new Helper.Rig()
const { tmp } = rig

const PLATFORM_STAGE_TIMEOUT = 45_000

test.hook('updates setup', rig.setup)

test('updates(listener) should notify when restaging and releasing application (same pear instance)', async function ({
  ok,
  is,
  plan,
  comment,
  teardown
}) {
  plan(7)
  const dir = Helper.fixture('updates')
  const testId = Helper.getRandomId()
  const stager1 = new Helper(rig)
  teardown(() => stager1.close(), { order: Infinity })
  await stager1.ready()

  comment('1. Stage and run app')

  comment('staging')
  const staging = stager1.stage(stageOpts(testId))
  teardown(() => Helper.teardownStream(staging))
  const until = await Helper.pick(staging, [{ tag: 'staging' }, { tag: 'final' }])
  const { key, link } = await until.staging
  await until.final

  comment('running')
  const { pipe } = await Helper.run({ link })
  const versions = await Helper.untilResult(pipe).then((data) => JSON.parse(data))
  ok(versions?.app, 'updater is ready')

  const untilUpdate1 = Helper.untilResult(pipe).then((data) => JSON.parse(data))
  const untilUpdate2 = untilUpdate1
    .then(() => Helper.untilResult(pipe))
    .then((data) => JSON.parse(data))

  comment('2. Create new file, restage, and reseed')

  const file = `${ts()}.tmp`
  comment(`\tcreating test file (${file})`)
  fs.writeFileSync(path.join(dir, file), 'test')
  teardown(() => {
    try {
      fs.unlinkSync(path.join(dir, file))
    } catch {
      /* ignore */
    }
  })

  comment('staging')
  const stager2 = new Helper(rig)
  teardown(() => stager2.close(), { order: Infinity })
  await stager2.ready()

  const staging2 = stager2.stage(stageOpts(testId))
  teardown(() => Helper.teardownStream(staging2))
  await Helper.pick(staging2, { tag: 'final' })

  fs.unlinkSync(path.join(dir, file))

  const update1 = await untilUpdate1
  const update1Version = update1?.version
  is(
    hypercoreid.normalize(update1Version?.key),
    hypercoreid.normalize(key),
    'app updated with matching key'
  )
  is(update1Version?.fork, 0, 'app version.fork is 0')
  ok(
    update1Version?.length > 0,
    `app version.length is non-zero (v${update1Version?.fork}.${update1Version?.length})`
  )

  comment('releasing')
  const releaser = new Helper(rig)
  teardown(() => releaser.close(), { order: Infinity })
  await releaser.ready()

  const releasing = releaser.release(releaseOpts(testId, key))
  teardown(() => Helper.teardownStream(releasing))
  await Helper.pick(releasing, { tag: 'released' })

  comment('waiting for update')
  const update2 = await untilUpdate2
  const update2Version = update2?.version
  is(
    hypercoreid.normalize(update2Version?.key),
    hypercoreid.normalize(key),
    'app updated with matching key'
  )
  is(update2Version?.fork, 0, 'app version.fork is 0')
  ok(
    update2Version?.length > update1Version?.length,
    `app version.length incremented (v${update2Version?.fork}.${update2Version?.length})`
  )

  await Helper.untilClose(pipe)
})

test('updates(listener) should notify twice when restaging application twice (same pear instance)', async function (t) {
  const { ok, is, plan, comment, teardown } = t
  plan(7)
  const dir = Helper.fixture('updates')
  const testId = Helper.getRandomId()

  comment('1. Stage and run app')

  comment('staging')
  const stager1 = new Helper(rig)
  teardown(() => stager1.close(), { order: Infinity })
  await stager1.ready()
  const staging = stager1.stage(stageOpts(testId))
  teardown(() => Helper.teardownStream(staging))
  const until = await Helper.pick(staging, [{ tag: 'staging' }, { tag: 'final' }])
  const { key, link } = await until.staging
  await until.final

  comment('running')
  const { pipe } = await Helper.run({ link })
  const versions = await Helper.untilResult(pipe).then((data) => JSON.parse(data))
  ok(versions?.app, 'updater is ready')

  const untilUpdate1 = Helper.untilResult(pipe).then((data) => JSON.parse(data))
  const untilUpdate2 = untilUpdate1
    .then(() => Helper.untilResult(pipe))
    .then((data) => JSON.parse(data))

  comment('2. Create new file, restage, and reseed')

  const file = `${ts()}.tmp`
  comment(`\tcreating test file (${file})`)
  fs.writeFileSync(path.join(dir, file), 'test')

  comment('restaging')
  const stager2 = new Helper(rig)
  teardown(() => stager2.close(), { order: Infinity })
  await stager2.ready()

  const staging2 = stager2.stage(stageOpts(testId))
  teardown(() => Helper.teardownStream(staging2))
  await Helper.pick(staging2, { tag: 'final' })
  fs.unlinkSync(path.join(dir, file))

  comment('waiting for update')
  const update1 = await untilUpdate1
  const update1Version = update1?.version
  is(
    hypercoreid.normalize(update1Version?.key),
    hypercoreid.normalize(key),
    'app updated with matching key'
  )
  is(update1Version?.fork, 0, 'app version.fork is 0')
  ok(
    update1Version?.length > 0,
    `app version.length is non-zero (v${update1Version?.fork}.${update1Version?.length})`
  )

  comment('3. Create another file and restage')

  const file2 = `${ts()}.tmp`
  comment(`\tcreating another test file (${file2})`)
  fs.writeFileSync(path.join(dir, file2), 'test')

  comment('restaging')
  const stager3 = new Helper(rig)
  teardown(() => stager3.close(), { order: Infinity })
  await stager3.ready()
  const staging3 = stager3.stage(stageOpts(testId))
  teardown(() => Helper.teardownStream(staging3))
  await Helper.pick(staging3, { tag: 'final' })

  fs.unlinkSync(path.join(dir, file2))

  comment('waiting for update')
  const update2 = await untilUpdate2
  const update2Version = update2?.version
  is(
    hypercoreid.normalize(update2Version?.key),
    hypercoreid.normalize(key),
    'app updated with matching key'
  )
  is(update2Version?.fork, 0, 'app version.fork is 0')
  ok(
    update2Version?.length > update1Version?.length,
    `app version.length incremented (v${update2Version?.fork}.${update2Version?.length})`
  )

  await Helper.untilClose(pipe)
})

test('updates should notify Platform stage updates (different pear instances)', async function (t) {
  const { ok, is, plan, timeout, comment, teardown } = t
  plan(8)
  timeout(80_000)
  const dir = Helper.fixture('updates')
  const appStager = new Helper(rig)
  teardown(() => appStager.close(), { order: Infinity })
  await appStager.ready()

  const channel = 'test-fixture'

  comment('staging app')
  const appStaging = appStager.stage({
    channel,
    name: channel,
    dir,
    dryRun: false
  })
  teardown(() => Helper.teardownStream(appStaging))
  const appFinal = await Helper.pick(appStaging, { tag: 'final' })
  ok(appFinal.success, 'stage succeeded')

  comment('seeding app')
  const appSeeder = new Helper(rig)
  teardown(() => appSeeder.close(), { order: Infinity })
  await appSeeder.ready()

  const appSeeding = appSeeder.seed({
    channel,
    name: channel,
    dir,
    key: null,
    cmdArgs: []
  })
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

  const untilUpdating = Helper.untilResult(pipe, {
    timeout: PLATFORM_STAGE_TIMEOUT
  }).then((data) => JSON.parse(data))
  const untilUpdate = untilUpdating
    .then(() => Helper.untilResult(pipe, { timeout: PLATFORM_STAGE_TIMEOUT }))
    .then((data) => JSON.parse(data))

  const ts = () => new Date().toISOString().replace(/[:.]/g, '-')
  const file = `${ts()}.tmp`
  comment(`creating platform test file (${file})`)
  fs.writeFileSync(path.join(rig.artefactDir, file), 'test')
  teardown(
    () => {
      try {
        fs.unlinkSync(path.join(rig.artefactDir, file))
      } catch {
        /* ignore */
      }
    },
    { order: -Infinity }
  )

  comment('restaging rig platform')
  const staging = rig.local.stage({
    channel: `test-${rig.id}`,
    name: `test-${rig.id}`,
    dir: rig.artefactDir,
    dryRun: false
  })
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
  ok(
    pearUpdateLength > pearVersionLength,
    `platform version.length incremented (v${updateVersion?.fork}.${updateVersion?.length})`
  )

  const rcv = new Helper({ platformDir: platformDirRcv, expectSidecar: true })
  await rcv.ready()
  await rcv.shutdown()

  comment('wait until rcv platform spins down')
  const corestorePath = path.join(platformDirRcv, 'corestores', 'platform')
  const store = new Corestore(corestorePath, { wait: true })
  await store.ready()
  await store.close()

  comment('rcv platform runs after updater.applyUpdate')
  const { pipe: pipeAfterUpdate } = await Helper.run({
    link: Helper.fixture('versions'),
    platformDir: platformDirRcv
  })
  const { platform } = await Helper.untilResult(pipeAfterUpdate).then((data) => JSON.parse(data))
  ok(platform.length > pearVersionLength, 'platform has been updated')

  const rcvB = new Helper({ platformDir: platformDirRcv, expectSidecar: true })
  await rcvB.ready()
  await rcvB.shutdown()

  await Helper.untilClose(pipe)
  await Helper.untilClose(pipeAfterUpdate)
})

test('updates should notify Platform stage, Platform release updates (different pear instances)', async function (t) {
  const { ok, is, plan, timeout, comment, teardown } = t
  plan(11)
  timeout(80_000)
  const dir = Helper.fixture('updates')
  const appStager = new Helper(rig)
  teardown(() => appStager.close(), { order: Infinity })
  await appStager.ready()

  const channel = 'test-fixture'

  comment('staging app')
  const appStaging = appStager.stage({
    channel,
    name: channel,
    dir,
    dryRun: false
  })
  teardown(() => Helper.teardownStream(appStaging))
  const appFinal = await Helper.pick(appStaging, { tag: 'final' })
  ok(appFinal.success, 'stage succeeded')

  comment('seeding app')
  const appSeeder = new Helper(rig)
  teardown(() => appSeeder.close(), { order: Infinity })

  await appSeeder.ready()
  const appSeeding = appSeeder.seed({
    channel,
    name: channel,
    dir,
    key: null,
    cmdArgs: []
  })
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

  const untilUpdating1 = Helper.untilResult(pipe, {
    timeout: PLATFORM_STAGE_TIMEOUT
  }).then((data) => JSON.parse(data))
  const untilUpdate1 = untilUpdating1
    .then(() => Helper.untilResult(pipe, { timeout: PLATFORM_STAGE_TIMEOUT }))
    .then((data) => JSON.parse(data))
  const untilUpdating2 = untilUpdate1
    .then(() => Helper.untilResult(pipe, { timeout: PLATFORM_STAGE_TIMEOUT }))
    .then((data) => JSON.parse(data))
  const untilUpdate2 = untilUpdating2
    .then(() => Helper.untilResult(pipe, { timeout: PLATFORM_STAGE_TIMEOUT }))
    .then((data) => JSON.parse(data))

  const ts = () => new Date().toISOString().replace(/[:.]/g, '-')
  const file = `${ts()}.tmp`
  comment(`creating platform test file (${file})`)
  fs.writeFileSync(path.join(rig.artefactDir, file), 'test')
  teardown(
    () => {
      fs.unlinkSync(path.join(rig.artefactDir, file))
    },
    { order: -Infinity }
  )

  comment('restaging rig platform')
  const staging = rig.local.stage({
    channel: `test-${rig.id}`,
    name: `test-${rig.id}`,
    dir: rig.artefactDir,
    dryRun: false
  })
  teardown(() => Helper.teardownStream(staging))
  await Helper.pick(staging, { tag: 'final' })
  comment('rig platform restaged')

  comment('waiting for platform updating notification')
  const updating1 = await untilUpdating1
  ok(updating1.updating, 'platform is updating')

  comment('waiting for update')
  const update1 = await untilUpdate1
  const update1Version = update1?.version
  const pearUpdateLength = update1Version.length
  ok(update1.updated, 'platform has been updated')
  ok(
    pearUpdateLength > pearVersionLength,
    `platform version.length incremented (v${update1Version?.fork}.${update1Version?.length})`
  )

  comment('releasing rig platform')
  const releasing = rig.local.release({
    channel: `test-${rig.id}`,
    name: `test-${rig.id}`,
    dir: rig.artefactDir
  })
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
  ok(
    pearUpdate2Length > pearUpdateLength,
    `platform version length incremented (v${update2Version?.fork}.${update2Version?.length})`
  )

  const rcv = new Helper({ platformDir: platformDirRcv, expectSidecar: true })
  await rcv.ready()
  await rcv.shutdown()

  await Helper.untilClose(pipe)
})

test('updates should notify App stage updates (different pear instances)', async function (t) {
  const { ok, is, plan, timeout, comment, teardown } = t
  plan(6)
  timeout(80_000)
  const dir = Helper.fixture('updates')
  const appStager = new Helper(rig)
  teardown(() => appStager.close(), { order: Infinity })
  await appStager.ready()
  const channel = 'test-fixture'

  comment('staging app')
  const appStaging = appStager.stage({
    channel,
    name: channel,
    dir,
    dryRun: false
  })
  teardown(() => Helper.teardownStream(appStaging))
  const appFinal = await Helper.pick(appStaging, { tag: 'final' })
  ok(appFinal.success, 'stage succeeded')

  comment('seeding app')
  const appSeeder = new Helper(rig)
  teardown(() => appSeeder.close(), { order: Infinity })
  await appSeeder.ready()
  const appSeeding = appSeeder.seed({
    channel,
    name: channel,
    dir,
    key: null,
    cmdArgs: []
  })
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
  fs.writeFileSync(path.join(dir, file), 'test')
  teardown(
    () => {
      fs.unlinkSync(path.join(dir, file))
    },
    { order: -Infinity }
  )

  comment('restaging app')
  const appStager2 = new Helper(rig)
  teardown(() => appStager2.close(), { order: Infinity })
  await appStager2.ready()
  const appStaging2 = appStager2.stage({
    channel,
    name: channel,
    dir,
    dryRun: false
  })
  teardown(() => Helper.teardownStream(appStaging2))
  const appFinal2 = await Helper.pick(appStaging2, { tag: 'final' })
  ok(appFinal2.success, 'stage succeeded')

  const update = await untilUpdate
  const updateVersion = update?.version
  const appUpdateLength = updateVersion.length
  ok(
    appUpdateLength > appVersionLength,
    `app version.length incremented (v${updateVersion?.fork}.${updateVersion?.length})`
  )

  const rcv = new Helper({ platformDir: platformDirRcv, expectSidecar: true })
  await rcv.ready()
  await rcv.shutdown()

  await Helper.untilClose(pipe)
})

test('updates should notify App stage, App release updates (different pear instances)', async function (t) {
  const { ok, is, plan, timeout, comment, teardown } = t
  plan(8)
  timeout(80_000)
  const dir = Helper.fixture('updates')
  const appStager = new Helper(rig)
  teardown(() => appStager.close(), { order: Infinity })
  await appStager.ready()

  const channel = 'test-fixture'

  comment('staging app')
  const appStaging = appStager.stage({
    channel,
    name: channel,
    dir,
    dryRun: false
  })
  teardown(() => Helper.teardownStream(appStaging))
  const appFinal = await Helper.pick(appStaging, { tag: 'final' })
  ok(appFinal.success, 'stage succeeded')

  comment('seeding app')
  const appSeeder = new Helper(rig)
  teardown(() => appSeeder.close(), { order: Infinity })
  await appSeeder.ready()
  const appSeeding = appSeeder.seed({
    channel,
    name: channel,
    dir,
    key: null,
    cmdArgs: []
  })
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
  const untilUpdate2 = untilUpdate1
    .then(() => Helper.untilResult(pipe))
    .then((data) => JSON.parse(data))

  const ts = () => new Date().toISOString().replace(/[:.]/g, '-')
  const file = `${ts()}.tmp`
  comment(`creating app test file (${file})`)
  fs.writeFileSync(path.join(dir, file), 'test')
  teardown(
    () => {
      fs.unlinkSync(path.join(dir, file))
    },
    { order: -Infinity }
  )

  comment('restaging app')
  const appStager2 = new Helper(rig)
  teardown(() => appStager2.close(), { order: Infinity })
  await appStager2.ready()
  const appStaging2 = appStager2.stage({
    channel,
    name: channel,
    dir,
    dryRun: false
  })
  teardown(() => Helper.teardownStream(appStaging2))
  const appFinal2 = await Helper.pick(appStaging2, { tag: 'final' })
  ok(appFinal2.success, 'stage succeeded')

  const update1 = await untilUpdate1
  const update1Version = update1?.version
  const appUpdateLength = update1Version.length
  ok(
    appUpdateLength > appVersionLength,
    `app version.length incremented (v${update1Version?.fork}.${update1Version?.length})`
  )

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

  is(
    hypercoreid.normalize(update2Version?.key),
    hypercoreid.normalize(appKey),
    'app release update matches staging key'
  )
  ok(
    appUpdate2Length > appUpdateLength,
    `app version length incremented (v${update2Version?.fork}.${update2Version?.length})`
  )

  const rcv = new Helper({ platformDir: platformDirRcv, expectSidecar: true })
  await rcv.ready()
  await rcv.shutdown()

  await Helper.untilClose(pipe)
})

// IMPORTANT: AVOID INSPECTING SIDECAR IN TESTS. THIS IS AN EXCEPTION TO THE RULE

test('state version and pod drive version match', async function ({
  comment,
  teardown,
  is,
  timeout
}) {
  timeout(90_000)

  const helper = new Helper()
  teardown(() => helper.close(), { order: Infinity })
  await helper.ready()

  const tmpdir = await testTmp()

  const from = new Localdrive(Helper.fixture('versions'))
  const to = new Localdrive(tmpdir)

  const mirror = from.mirror(to)
  await mirror.done()

  const pkgA = {
    name: 'tmp-app-a',
    main: 'index.js',
    pear: { name: 'tmp-app' }
  }
  await fs.promises.writeFile(path.join(tmpdir, 'package.json'), JSON.stringify(pkgA))

  const id = Helper.getRandomId()

  comment('first stage')
  const stagingA = helper.stage({
    channel: `test-${id}`,
    name: `test-${id}`,
    dir: tmpdir,
    dryRun: false
  })
  teardown(() => Helper.teardownStream(stagingA))
  const stagedA = await Helper.pick(stagingA, [{ tag: 'addendum' }, { tag: 'final' }])
  const { key } = await stagedA.addendum
  await stagedA.final

  comment('seeding')
  const seeding = helper.seed({
    channel: `test-${id}`,
    name: `test-${id}`,
    dir: tmpdir,
    key: null,
    cmdArgs: []
  })
  teardown(() => Helper.teardownStream(seeding))
  const until = await Helper.pick(seeding, [{ tag: 'key' }, { tag: 'announced' }])
  await until.announced

  comment('bootstrapping rcv platform...')
  const platformDirRcv = path.join(tmp, 'rcv-pear')
  await Helper.bootstrap(rig.key, platformDirRcv)
  comment('rcv platform bootstrapped')

  comment('first run from rcv platform')
  const link = 'pear://' + key
  const { pipe } = await Helper.run({ link, platformDir: platformDirRcv })
  await Helper.untilClose(pipe)
  pipe.on('error', () => {})

  comment('shutdown rcv platform')
  const rcv = new Helper({ platformDir: platformDirRcv, expectSidecar: true })
  await rcv.ready()
  await rcv.shutdown()

  const pkgB = {
    name: 'tmp-app-b',
    main: 'index.js',
    pear: { name: 'tmp-app' }
  }
  await fs.promises.writeFile(path.join(tmpdir, 'package.json'), JSON.stringify(pkgB))

  comment('second stage')
  const stagingB = helper.stage({
    channel: `test-${id}`,
    name: `test-${id}`,
    dir: tmpdir,
    dryRun: false
  })
  teardown(() => Helper.teardownStream(stagingB))
  const stagedB = await Helper.pick(stagingB, [{ tag: 'final' }])
  await stagedB.final

  comment('second run from rcv platform')
  const { pipe: pipeB } = await Helper.run({
    link,
    platformDir: platformDirRcv
  })
  pipeB.on('error', () => {})

  const resultB = await Helper.untilResult(pipeB)
  const version = JSON.parse(resultB)

  const rcvB = new Helper({
    platformDir: platformDirRcv,
    expectSidecar: true
  })
  await rcvB.ready()

  comment('inspect rcv platform')
  const inspectorKey = await rcvB.inspect()
  const session = new Session({ inspectorKey, bootstrap: null })
  teardown(() => {
    session.destroy()
  })
  session.connect()

  const inspectorResult = new Promise((resolve) => {
    session.on('message', ({ result }) => {
      resolve(result)
    })
  })

  session.post({
    method: 'Runtime.evaluate',
    params: { expression: 'global.sidecar.apps[0].pod.drive.version' }
  })

  const { result } = await inspectorResult
  is(result.value, version.app.length, 'state.version.length matches pod.drive.version')

  pipeB.end()
  await rcvB.shutdown()
})

test('updates should replay updates when cutover is not called', async function (t) {
  const { ok, is, plan, timeout, comment, teardown, pass } = t
  plan(11)
  timeout(80_000)
  const dir = Helper.fixture('cutover')
  const appStager = new Helper(rig)
  teardown(() => appStager.close(), { order: Infinity })
  await appStager.ready()

  const channel = 'test-fixture-no-cutover'

  comment('staging app')
  const appStaging = appStager.stage({
    channel,
    name: channel,
    dir,
    dryRun: false
  })
  teardown(() => Helper.teardownStream(appStaging))
  const appFinal = await Helper.pick(appStaging, { tag: 'final' })
  ok(appFinal.success, 'stage succeeded')

  comment('seeding app')
  const appSeeder = new Helper(rig)
  teardown(() => appSeeder.close(), { order: Infinity })
  await appSeeder.ready()
  const appSeeding = appSeeder.seed({
    channel,
    name: channel,
    dir,
    key: null,
    cmdArgs: []
  })
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
  const { pipe } = await Helper.run({
    link,
    platformDir: platformDirRcv,
    args: ['--no-dirs']
  })
  const versions = await Helper.untilResult(pipe).then((data) => JSON.parse(data))
  const { key: appVersionKey, length: appVersionLength } = versions?.app || {}
  is(appVersionKey, appKey, 'app version key matches staged key')

  const untilUpdate = Helper.untilResult(pipe, {
    timeout: 30_000,
    runFn: () => {}
  }).then((data) => JSON.parse(data.split('\n').at(-1))) // get last line as buffered data is combined into one string

  const ts = () => new Date().toISOString().replace(/[:.]/g, '-')
  const file = `${ts()}.tmp`
  comment(`creating app test file (${file})`)
  fs.writeFileSync(path.join(dir, file), 'test')
  teardown(
    () => {
      fs.unlinkSync(path.join(dir, file))
    },
    { order: -Infinity }
  )

  comment('restaging app')
  const appStager2 = new Helper(rig)
  teardown(() => appStager2.close(), { order: Infinity })
  await appStager2.ready()
  const appStaging2 = appStager2.stage({
    channel,
    name: channel,
    dir,
    dryRun: false
  })
  teardown(() => Helper.teardownStream(appStaging2))
  const appFinal2 = await Helper.pick(appStaging2, { tag: 'final' })
  ok(appFinal2.success, 'stage succeeded')

  await new Promise((resolve) => setTimeout(resolve, 1000)) // allow update to buffer

  pipe.write('start-listener\n')

  const update = await untilUpdate
  pass('app has received replayed update')
  is(update?.id, 1, 'app update id is 1 (first update subscription)')
  const updateVersion = update?.data?.version
  const appUpdateLength = updateVersion.length
  ok(
    appUpdateLength > appVersionLength,
    `app version.length incremented (v${updateVersion?.fork}.${updateVersion?.length})`
  )

  const untilUpdate2 = Helper.untilResult(pipe, {
    timeout: 30_000,
    info: 'start-listener\n'
  }).then((data) => JSON.parse(data.split('\n').at(-1)))

  const update2 = await untilUpdate2
  pass('app has received replayed update')
  is(update2?.id, 2, 'app update id is 2 (second update subscription)')
  const updateVersion2 = update?.data?.version
  const appUpdateLength2 = updateVersion2.length
  ok(
    appUpdateLength2 > appVersionLength,
    `app version.length incremented (v${updateVersion2?.fork}.${updateVersion2?.length})`
  )

  const rcv = new Helper({ platformDir: platformDirRcv, expectSidecar: true })
  await rcv.ready()
  await rcv.shutdown()

  await Helper.untilClose(pipe)
})

test('updates should replay updates even when cutover is called', async function (t) {
  const { ok, is, plan, timeout, comment, teardown, pass } = t
  plan(11)
  timeout(80_000)
  const dir = Helper.fixture('cutover')
  const appStager = new Helper(rig)
  teardown(() => appStager.close(), { order: Infinity })
  await appStager.ready()

  const channel = 'test-fixture-with-cutover'

  comment('staging app')
  const appStaging = appStager.stage({
    channel,
    name: channel,
    dir,
    dryRun: false
  })
  teardown(() => Helper.teardownStream(appStaging))
  const appFinal = await Helper.pick(appStaging, { tag: 'final' })
  ok(appFinal.success, 'stage succeeded')

  comment('seeding app')
  const appSeeder = new Helper(rig)
  teardown(() => appSeeder.close(), { order: Infinity })
  await appSeeder.ready()
  const appSeeding = appSeeder.seed({
    channel,
    name: channel,
    dir,
    key: null,
    cmdArgs: []
  })
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
  const { pipe } = await Helper.run({
    link,
    platformDir: platformDirRcv,
    args: []
  })
  const versions = await Helper.untilResult(pipe).then((data) => JSON.parse(data))
  const { key: appVersionKey, length: appVersionLength } = versions?.app || {}
  is(appVersionKey, appKey, 'app version key matches staged key')

  const untilUpdate = Helper.untilResult(pipe, {
    timeout: 30_000,
    runFn: () => {}
  }).then((data) => JSON.parse(data.split('\n').at(-1))) // get last line as buffered data is combined into one string

  const ts = () => new Date().toISOString().replace(/[:.]/g, '-')
  const file = `${ts()}.tmp`
  comment(`creating app test file (${file})`)
  fs.writeFileSync(path.join(dir, file), 'test')
  teardown(
    () => {
      fs.unlinkSync(path.join(dir, file))
    },
    { order: -Infinity }
  )

  comment('restaging app')
  const appStager2 = new Helper(rig)
  teardown(() => appStager2.close(), { order: Infinity })
  await appStager2.ready()
  const appStaging2 = appStager2.stage({
    channel,
    name: channel,
    dir,
    dryRun: false
  })
  teardown(() => Helper.teardownStream(appStaging2))
  const appFinal2 = await Helper.pick(appStaging2, { tag: 'final' })
  ok(appFinal2.success, 'stage succeeded')

  await new Promise((resolve) => setTimeout(resolve, 1000)) // allow update to buffer

  pipe.write('start-listener\n')

  const update = await untilUpdate
  pass('app has received replayed update')
  is(update?.id, 1, 'app update id is 1 (first update subscription)')
  const updateVersion = update?.data?.version
  const appUpdateLength = updateVersion.length
  ok(
    appUpdateLength > appVersionLength,
    `app version.length incremented (v${updateVersion?.fork}.${updateVersion?.length})`
  )

  const untilUpdate2 = Helper.untilResult(pipe, {
    timeout: 30_000,
    info: 'start-listener\n'
  }).then((data) => JSON.parse(data.split('\n').at(-1)))

  const update2 = await untilUpdate2
  pass('app has received replayed update')
  is(update2?.id, 2, 'app update id is 2 (second update subscription)')
  const updateVersion2 = update?.data?.version
  const appUpdateLength2 = updateVersion2.length
  ok(
    appUpdateLength2 > appVersionLength,
    `app version.length incremented (v${updateVersion2?.fork}.${updateVersion2?.length})`
  )

  const rcv = new Helper({ platformDir: platformDirRcv, expectSidecar: true })
  await rcv.ready()
  await rcv.shutdown()

  await Helper.untilClose(pipe)
})

test('updates should start timer for clearing buffer when cutover is called', async (t) => {
  const { ok, is, absent, plan, timeout, comment, teardown, pass } = t
  plan(5)
  timeout(80_000)
  const dir = Helper.fixture('cutover')
  const CUTOVER_DELAY = 2_000

  comment('1. Prepare reduced timeout platform as rcv')
  const patchedArtefactDir = path.join(Helper.tmp, 'urcv-pear')
  comment(`\tCopying platform code to ${patchedArtefactDir}`)
  await fs.promises.mkdir(patchedArtefactDir, { recursive: true })
  teardown(() => Helper.gc(patchedArtefactDir))
  const mirror = new Localdrive(rig.artefactDir).mirror(new Localdrive(patchedArtefactDir), {
    prune: false,
    ignore: ['/pear', '/.git', '/test']
  })
  await mirror.done()

  comment('Patching sidecar to have reduced timeout')
  const sidecarPath = path.join(patchedArtefactDir, 'subsystems', 'sidecar', 'index.js')
  const sidecarCode = fs.readFileSync(sidecarPath, 'utf8')
  const patchedSidecarCode = sidecarCode.replace(
    /(const\s+CUTOVER_DELAY\s+=)\s+[\d_]+\n/,
    `$1 ${CUTOVER_DELAY}
`
  )
  fs.writeFileSync(sidecarPath, patchedSidecarCode)

  comment('Staging patched platform')
  const rigHelper = new Helper(rig)
  teardown(() => rigHelper.close(), { order: Infinity })
  await rigHelper.ready()

  const patchedStager = rigHelper.stage({
    channel: 'test-reduced-cutover',
    name: 'test-reduced-cutover',
    dir: patchedArtefactDir,
    dryRun: false
  })
  const patchedStagerUntil = await Helper.pick(patchedStager, [{ tag: 'final' }])
  await patchedStagerUntil.final

  comment('Seeding patched platform')
  const patchedSeeder = rigHelper.seed({
    channel: 'test-reduced-cutover',
    name: 'test-reduced-cutover',
    dir: patchedArtefactDir,
    key: null,
    cmdArgs: []
  })
  const patchedSeederUntil = await Helper.pick(patchedSeeder, [
    { tag: 'key' },
    { tag: 'announced' }
  ])
  const patchedPlatformKey = await patchedSeederUntil.key
  await patchedSeederUntil.announced
  teardown(() => Helper.teardownStream(patchedSeeder))

  comment('Bootstrapping patched platform')
  const platformDirRcv = path.join(Helper.tmp, 'prcv-pear')
  await Helper.bootstrap(patchedPlatformKey, platformDirRcv)
  teardown(() => Helper.gc(platformDirRcv))

  await Helper.teardownStream(patchedSeeder)
  await rigHelper.close()

  comment('2. Start patched rcv platform')
  comment('Starting rcv platform')
  const rcvHelper = new Helper({ platformDir: platformDirRcv })
  teardown(() => rcvHelper.close(), { order: Infinity })
  await rcvHelper.ready()

  comment('3. Stage and start app using rig')
  comment('Staging app using rig')
  const channel = 'test-fixture-no-cutover'
  const appStager = new Helper(rig)
  await appStager.ready()
  const staging = appStager.stage({
    channel,
    name: channel,
    dir,
    dryRun: false
  })
  const stagingUntil = await Helper.pick(staging, [{ tag: 'final' }])
  await stagingUntil.final

  comment('Seeding staged app using rcv')
  const appSeeder = new Helper(rig)
  await appSeeder.ready()
  const seeding = appSeeder.seed({
    channel,
    name: channel,
    dir,
    key: null,
    cmdArgs: []
  })
  teardown(() => Helper.teardownStream(seeding))

  const seedingUntil = await Helper.pick(seeding, [{ tag: 'announced' }, { tag: 'key' }])
  await seedingUntil.announced
  pass('App seeded and announced')
  const appKey = await seedingUntil.key

  ok(hypercoreid.isValid(appKey), 'app key is valid')

  comment('4. Start app using rcv platform')
  comment('Starting app using rcv platform')
  const link = 'pear://' + appKey
  const { pipe } = await Helper.run({
    link,
    platformDir: platformDirRcv,
    args: []
  })
  const versions = await Helper.untilResult(pipe).then((data) => JSON.parse(data))
  const { key: appVersionKey } = versions?.app || {}
  is(appVersionKey, appKey, 'app version key matches staged key')

  comment('5. Update app')
  const ts = () => new Date().toISOString().replace(/[:.]/g, '-')
  const file = `${ts()}.tmp`
  comment(`\tCreating app test file (${file})`)
  fs.writeFileSync(path.join(dir, file), 'test')
  teardown(
    () => {
      fs.unlinkSync(path.join(dir, file))
    },
    { order: -Infinity }
  )

  comment('Restaging app')
  const appStager2 = new Helper(rig)
  teardown(() => appStager2.close(), { order: Infinity })
  await appStager2.ready()
  const appStaging2 = appStager2.stage({
    channel,
    name: channel,
    dir,
    dryRun: false
  })
  teardown(() => Helper.teardownStream(appStaging2))
  const appFinal2 = await Helper.pick(appStaging2, { tag: 'final' })
  ok(appFinal2.success, 'stage succeeded')

  await new Promise((resolve) => setTimeout(resolve, CUTOVER_DELAY + 500))

  const untilUpdate = Helper.untilResult(pipe, {
    timeout: 1000,
    info: 'start-listener\n'
  }).then((data) => JSON.parse(data.split('\n').at(-1)))

  const update = await untilUpdate.catch(() => null)
  absent(update, 'app should not receive any replayed update as cutover should have timed out')

  const rcv = new Helper({ platformDir: platformDirRcv, expectSidecar: true })
  await rcv.ready()
  await rcv.shutdown()

  await Helper.untilClose(pipe)
})

test.hook('updates cleanup', rig.cleanup)
