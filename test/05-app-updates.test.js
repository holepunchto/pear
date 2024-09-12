const test = require('brittle')
const path = require('bare-path')
const os = require('bare-os')
const fs = require('bare-fs')
const hypercoreid = require('hypercore-id-encoding')
const Helper = require('./helper')
const harness = path.join(Helper.root, 'test', 'fixtures', 'harness')

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
    comment('shutdown local sidecar')
    await this.helper.shutdown()
    comment('local sidecar shutdown')
  }
}

const rig = new Rig()

test.hook('updates setup', rig.setup)

test('Pear.updates should notify App stage updates (different pear instances)', async function (t) {
  const { ok, is, plan, timeout, comment, teardown } = t
  plan(10)
  timeout(180000)
  const appStager = new Helper(rig)
  teardown(() => appStager.close())
  await appStager.ready()
  const pid = Math.floor(Math.random() * 10000)
  const fid = 'fixture'
  const dir = harness

  comment('staging app')
  const appStaging = appStager.stage({ channel: `test-${fid}`, name: `test-${fid}`, dir, dryRun: false, bare: true })
  const appFinal = await Helper.pick(appStaging, { tag: 'final' })
  ok(appFinal.success, 'stage succeeded')

  comment('seeding app')
  const appSeeder = new Helper(rig)
  teardown(() => appSeeder.close())
  await appSeeder.ready()
  const appSeeding = appSeeder.seed({ channel: `test-${fid}`, name: `test-${fid}`, dir, key: null, cmdArgs: [] })
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
  // teardown(() => { fs.unlinkSync(path.join(platformDirRcv, prefs)) }, { order: -Infinity })
  comment('rcv platform bootstrapped')

  comment('running app from rcv platform')

  const link = 'pear://' + appKey
  const running = await Helper.open(link, { tags: ['exit'] }, { platformDir: platformDirRcv })
  const { value } = await running.inspector.evaluate('Pear.versions()', { awaitPromise: true })
  const { key: appVersionKey, length: appVersionLength } = value?.app || {}
  is(appVersionKey, appKey, 'app version key matches staged key')

  const updatePromise = await running.inspector.evaluate('__PEAR_TEST__.nextUpdate()', { returnByValue: false })
  const updateActualPromise = running.inspector.awaitPromise(updatePromise.objectId)

  const ts = () => new Date().toISOString().replace(/[:.]/g, '-')
  const file = `${ts()}.tmp`
  comment(`creating app test file (${file})`)
  fs.writeFileSync(path.join(dir, file), 'test')
  // teardown(() => { fs.unlinkSync(path.join(dir, file)) }, { order: -Infinity })

  comment('restaging app')
  const appStager2 = new Helper(rig)
  teardown(() => appStager2.close())
  await appStager2.ready()
  const appStaging2 = appStager2.stage({ channel: `test-${fid}`, name: `test-${fid}`, dir, dryRun: false, bare: true })
  const appFinal2 = await Helper.pick(appStaging2, { tag: 'final' })
  ok(appFinal2.success, 'stage succeeded')

  const update = await updateActualPromise
  const updateVersion = update?.value?.version
  const appUpdateLength = updateVersion.length
  ok(appUpdateLength > appVersionLength, `app version.length incremented (v${updateVersion?.fork}.${updateVersion?.length})`)

  await running.inspector.evaluate('__PEAR_TEST__.close()')
  await running.inspector.close()
  const { code } = await running.until.exit
  is(code, 0, 'exit code is 0')
})

// test('Pear.updates should notify App stage, App release updates (different pear instances)', async function (t) {
//   const { ok, is, plan, timeout, comment, teardown } = t
//   plan(12)
//   timeout(180000)
//   const appStager = new Helper(rig)
//   teardown(() => appStager.close())
//   await appStager.ready()
//   const pid = Math.floor(Math.random() * 10000)
//   const fid = 'fixture'
//   const dir = harness

//   comment('staging app')
//   const appStaging = appStager.stage({ channel: `test-${fid}`, name: `test-${fid}`, dir, dryRun: false, bare: true })
//   const appFinal = await Helper.pick(appStaging, { tag: 'final' })
//   ok(appFinal.success, 'stage succeeded')

//   comment('seeding app')
//   const appSeeder = new Helper(rig)
//   teardown(() => appSeeder.close())
//   await appSeeder.ready()
//   const appSeeding = appSeeder.seed({ channel: `test-${fid}`, name: `test-${fid}`, dir, key: null, cmdArgs: [] })
//   const untilApp = await Helper.pick(appSeeding, [{ tag: 'key' }, { tag: 'announced' }])

//   const appKey = await untilApp.key
//   const appAnnounced = await untilApp.announced

//   ok(hypercoreid.isValid(appKey), 'app key is valid')
//   ok(appAnnounced, 'seeding is announced')

//   comment('staging tmp platform')
//   const stager = new Helper(rig)
//   teardown(() => stager.close())
//   await stager.ready()
//   const staging = stager.stage({ channel: `test-${pid}`, name: `test-${pid}`, dir: Helper.root, dryRun: false, bare: true })
//   const final = await Helper.pick(staging, { tag: 'final' })
//   ok(final.success, 'stage succeeded')

//   comment('seeding tmp platform')
//   const seeder = new Helper(rig)
//   teardown(() => seeder.close())
//   await seeder.ready()
//   const seeding = seeder.seed({ channel: `test-${pid}`, name: `test-${pid}`, dir: Helper.root, key: null, cmdArgs: [] })
//   const until = await Helper.pick(seeding, [{ tag: 'key' }, { tag: 'announced' }])

//   const key = await until.key
//   ok(hypercoreid.isValid(key), 'platform key is valid')

//   const announced = await until.announced
//   ok(announced, 'seeding is announced')

//   comment('bootstrapping rcv platform...')
//   const platformDirRcv = path.join(tmp, 'rcv-pear')
//   await Helper.bootstrap(key, platformDirRcv)
//   const prefs = 'preferences.json'
//   fs.writeFileSync(path.join(platformDirRcv, prefs), JSON.stringify({ trusted: [appKey] }))
//   teardown(() => { fs.unlinkSync(path.join(platformDirRcv, prefs)) }, { order: -Infinity })
//   comment('rcv platform bootstrapped')

//   comment('running app from rcv platform')
//   const link = 'pear://' + appKey
//   const running = await Helper.open(link, { tags: ['exit'] }, { platformDir: platformDirRcv })
//   const { value } = await running.inspector.evaluate('Pear.versions()', { awaitPromise: true })
//   const { key: appVersionKey, length: appVersionLength } = value?.app || {}
//   is(appVersionKey, appKey, 'app version key matches staged key')

//   const update1Promise = await running.inspector.evaluate('__PEAR_TEST__.nextUpdate()', { returnByValue: false })
//   const update1ActualPromise = running.inspector.awaitPromise(update1Promise.objectId)
//   const update2LazyPromise = update1ActualPromise.then(() => running.inspector.evaluate('__PEAR_TEST__.nextUpdate()', { returnByValue: false }))

//   const ts = () => new Date().toISOString().replace(/[:.]/g, '-')
//   const file = `${ts()}.tmp`
//   comment(`creating app test file (${file})`)
//   fs.writeFileSync(path.join(dir, file), 'test')
//   teardown(() => { fs.unlinkSync(path.join(dir, file)) }, { order: -Infinity })

//   comment('restaging app')
//   const appStager2 = new Helper(rig)
//   teardown(() => appStager2.close())
//   await appStager2.ready()
//   const appStaging2 = appStager2.stage({ channel: `test-${fid}`, name: `test-${fid}`, dir, dryRun: false, bare: true })
//   const appFinal2 = await Helper.pick(appStaging2, { tag: 'final' })
//   ok(appFinal2.success, 'stage succeeded')

//   const update1 = await update1ActualPromise
//   const update1Version = update1?.value?.version
//   const appUpdateLength = update1Version.length
//   ok(appUpdateLength > appVersionLength, `app version.length incremented (v${update1Version?.fork}.${update1Version?.length})`)

//   comment('releasing app')
//   const update2Promise = await update2LazyPromise
//   const update2ActualPromise = running.inspector.awaitPromise(update2Promise.objectId)
//   const releaser = new Helper(rig)
//   teardown(() => releaser.close())
//   await releaser.ready()

//   const releasing = releaser.release({ channel: `test-${fid}`, name: `test-${fid}`, key: appKey })
//   await Helper.pick(releasing, { tag: 'released' })

//   comment('waiting for app update notification')
//   const update2 = await update2ActualPromise
//   const update2Version = update2?.value?.version
//   const appUpdate2Length = update2Version.length

//   is(hypercoreid.normalize(update2Version?.key), hypercoreid.normalize(appKey), 'app release update matches staging key')
//   ok(appUpdate2Length > appUpdateLength, `app version length incremented (v${update2Version?.fork}.${update2Version?.length})`)

//   await running.inspector.evaluate('__PEAR_TEST__.close()')
//   await running.inspector.close()
//   const { code } = await running.until.exit
//   is(code, 0, 'exit code is 0')
// })

test.hook('updates cleanup', rig.cleanup)
