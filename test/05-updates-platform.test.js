'use strict'
const test = require('brittle')
const Helper = require('./helper')
const path = require('bare-path')
const os = require('bare-os')
const fs = require('bare-fs')
const Localdrive = require('localdrive')

test('Pear.updates should notify Platform updates between different platform instances', async function (t) {
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

  teardown(() => { gc(tmpLocaldev).catch(console.error) }, { order: Infinity })
  teardown(() => { gc(tmpPearDir).catch(console.error) }, { order: Infinity })

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
  teardown(async () => { appStager.shutdown() })

  const pid = Math.floor(Math.random() * 10000)
  const fid = 'fixture'
  const appDir = path.join(tmpLocaldev, 'test', 'fixtures', 'terminal')

  comment('staging app')
  const appStaging = appStager.stage({ id: Math.floor(Math.random() * 10000), channel: `test-${fid}`, name: `test-${fid}`, dir: appDir, dryRun: false, bare: true })
  const appFinal = await Helper.pick(appStaging, { tag: 'final' })
  ok(appFinal.success, 'stage succeeded')

  comment('seeding app')
  const appSeeder = new Helper({ platformDir })
  teardown(async () => { appSeeder.shutdown() })
  await appSeeder.ready()
  const appSeeding = appSeeder.seed({ id: Math.floor(Math.random() * 10000), channel: `test-${fid}`, name: `test-${fid}`, dir: appDir, key: null, clientArgv: [] })
  const untilApp = await Helper.pick(appSeeding, [{ tag: 'key' }, { tag: 'announced' }])

  const appKey = await untilApp.key
  const appAnnounced = await untilApp.announced

  ok(appKey, 'app key is ok')
  ok(appAnnounced, 'seeding is announced')

  const stager = new Helper({ platformDir })
  await stager.ready()
  teardown(async () => { stager.shutdown() })

  comment('staging platform A')
  const staging = stager.stage({ id: Math.floor(Math.random() * 10000), channel: `test-${pid}`, name: `test-${pid}`, dir: tmpLocaldev, dryRun: false, bare: true })
  const final = await Helper.pick(staging, { tag: 'final' })
  ok(final.success, 'stage succeeded')

  comment('seeding platform A')
  const seeder = new Helper({ platformDir })
  teardown(async () => { seeder.shutdown() })
  await seeder.ready()
  const seeding = seeder.seed({ id: Math.floor(Math.random() * 10000), channel: `test-${pid}`, name: `test-${pid}`, dir: tmpLocaldev, key: null, clientArgv: [] })
  const until = await Helper.pick(seeding, [{ tag: 'key' }, { tag: 'announced' }])

  const pearKey = await until.key
  const announced = await until.announced

  ok(pearKey, 'pear key is ok')
  ok(announced, 'seeding is announced')

  comment('bootstrapping platform B')
  await Helper.bootstrap(pearKey, tmpPearDir)
  teardown(async () => {
    const shutdowner = new Helper({ platformDir: tmpPearDir })
    await shutdowner.ready()
    await shutdowner.shutdown()
  }, { order: 1 })

  comment('setting up trust preferences')
  const prefs = 'preferences.json'
  fs.writeFileSync(path.join(tmpPearDir, prefs), JSON.stringify({ trusted: [appKey] }))
  teardown(() => fs.unlinkSync(path.join(tmpPearDir, prefs)), { order: -Infinity })

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
  comment(`creating test file (${file})`)
  fs.writeFileSync(path.join(tmpLocaldev, file), 'test')
  teardown(() => fs.unlinkSync(path.join(tmpLocaldev, file)), { order: -Infinity })

  comment('restaging platform A')
  const stager2 = new Helper({ platformDir })
  await stager2.ready()
  teardown(async () => { stager2.shutdown() })
  const staging2 = stager2.stage({ id: Math.floor(Math.random() * 10000), channel: `test-${pid}`, name: `test-${pid}`, dir: tmpLocaldev, dryRun: false, bare: true })
  const final2 = await Helper.pick(staging2, { tag: 'final' })
  ok(final2.success, 'stage succeeded')

  const update1 = await update1ActualPromise
  const update1Version = update1?.value?.version
  const pearUpdateLength = update1Version.length
  ok(pearUpdateLength > pearVersionLength, `platform version.length incremented (v${update1Version?.fork}.${update1Version?.length})`)

  comment('releasing')
  const update2Promise = await update2LazyPromise
  const update2ActualPromise = running.inspector.awaitPromise(update2Promise.objectId)
  const releaser = new Helper({ platformDir })
  await releaser.ready()
  teardown(async () => { releaser.shutdown() })

  const releasing = releaser.release({ id: Math.floor(Math.random() * 10000), channel: `test-${pid}`, name: `test-${pid}`, key: pearKey })
  await Helper.pick(releasing, { tag: 'released' })

  comment('waiting for update')
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
