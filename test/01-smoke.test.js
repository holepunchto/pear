'use strict'
const tmp = require('test-tmp')
const test = require('brittle')
const path = require('bare-path')
const hypercoreid = require('hypercore-id-encoding')
const LocalDrive = require('localdrive')
const { pathToFileURL } = require('url-file-url')
const Helper = require('./helper')
const versionsDir = path.join(Helper.localDir, 'test', 'fixtures', 'versions')
const dhtBootstrapDir = path.join(Helper.localDir, 'test', 'fixtures', 'dht-bootstrap')
const storageDir = path.join(Helper.localDir, 'test', 'fixtures', 'storage')
const requireAssets = path.join(Helper.localDir, 'test', 'fixtures', 'require-assets')
const subDepRequireAssets = path.join(Helper.localDir, 'test', 'fixtures', 'sub-dep-require-assets')
const entrypointAndFragment = path.join(Helper.localDir, 'test', 'fixtures', 'entrypoint-and-fragment')
const routesDir = path.join(Helper.localDir, 'test', 'fixtures', 'routes')

test('smoke', async function ({ ok, is, alike, plan, comment, teardown, timeout, test }) {
  timeout(180000)
  plan(14)

  const testVersions = async () => {
    const dir = versionsDir

    const helper = new Helper()
    teardown(() => helper.close(), { order: Infinity })
    await helper.ready()

    const id = Helper.getRandomId()

    comment('staging')
    const staging = helper.stage({ channel: `test-${id}`, name: `test-${id}`, dir, dryRun: false })
    teardown(() => Helper.teardownStream(staging))
    const staged = await Helper.pick(staging, { tag: 'final' })
    ok(staged.success, 'stage succeeded')

    comment('seeding')
    const seeding = helper.seed({ channel: `test-${id}`, name: `test-${id}`, dir, key: null, cmdArgs: [] })
    teardown(() => Helper.teardownStream(seeding))
    const until = await Helper.pick(seeding, [{ tag: 'key' }, { tag: 'announced' }])
    const announced = await until.announced
    ok(announced, 'seeding is announced')

    const key = await until.key
    ok(hypercoreid.isValid(key), 'app key is valid')

    const link = `pear://${key}`
    const run = await Helper.run({ link })

    const result = await Helper.untilResult(run.pipe)
    const versions = JSON.parse(result)
    is(versions.app.key, key, 'app version matches staged key')

    await Helper.untilClose(run.pipe)
    ok(true, 'ended')
  }

  const testDhtBootstrap = async () => {
    const dir = dhtBootstrapDir

    const helper = new Helper()
    teardown(() => helper.close(), { order: Infinity })
    await helper.ready()

    const id = Helper.getRandomId()

    comment('staging')
    const staging = helper.stage({ channel: `test-${id}`, name: `test-${id}`, dir, dryRun: false })
    teardown(() => Helper.teardownStream(staging))
    const staged = await Helper.pick(staging, { tag: 'final' })
    ok(staged.success, 'stage succeeded')

    comment('seeding')
    const seeding = helper.seed({ channel: `test-${id}`, name: `test-${id}`, dir, key: null, cmdArgs: [] })
    teardown(() => Helper.teardownStream(seeding))
    const until = await Helper.pick(seeding, [{ tag: 'key' }, { tag: 'announced' }])
    const announced = await until.announced
    ok(announced, 'seeding is announced')

    const key = await until.key
    ok(hypercoreid.isValid(key), 'app key is valid')

    const link = `pear://${key}`
    const run = await Helper.run({ link })

    const result = await Helper.untilResult(run.pipe)
    const dhtBootstrap = JSON.parse(result)
    alike(dhtBootstrap, Pear.config.dht.bootstrap, 'dht bootstrap matches Pear.config.dht.bootstrap')

    await Helper.untilClose(run.pipe)
    ok(true, 'ended')
  }

  const testStorage = async () => {
    const dir = storageDir

    const testAppStorage = Pear.config.storage
    ok(testAppStorage.includes('by-random'))

    const helper = new Helper()
    teardown(() => helper.close(), { order: Infinity })
    await helper.ready()

    const id = Helper.getRandomId()

    comment('staging')
    const staging = helper.stage({ channel: `test-${id}`, name: `test-${id}`, dir, dryRun: false, bare: true })
    teardown(() => Helper.teardownStream(staging))
    const staged = await Helper.pick(staging, [{ tag: 'addendum' }, { tag: 'final' }])
    const { key } = await staged.addendum
    await staged.final

    const link = `pear://${key}`
    const run = await Helper.run({ link })

    const result = await Helper.untilResult(run.pipe)
    const appStorage = result

    await Helper.untilClose(run.pipe)

    const linkWithFragment = `pear://${key}/#fragment`
    const runWithFragment = await Helper.run({ link: linkWithFragment })
    const resultWithFragment = await Helper.untilResult(runWithFragment.pipe)
    const appStorageWithFragment = resultWithFragment

    await Helper.untilClose(runWithFragment.pipe)

    ok(appStorage.includes('by-dkey'))
    is(appStorage, appStorageWithFragment)

    ok(true, 'ended')
  }

  await Promise.all([testVersions(), testDhtBootstrap(), testStorage()])
})

test('app with assets', async function ({ ok, is, plan, comment, teardown, timeout }) {
  timeout(180000)
  plan(5)

  const dir = requireAssets

  const helper = new Helper()
  teardown(() => helper.close(), { order: Infinity })
  await helper.ready()

  const id = Helper.getRandomId()

  comment('staging')
  const staging = helper.stage({ channel: `test-${id}`, name: `test-${id}`, dir, dryRun: false })
  teardown(() => Helper.teardownStream(staging))
  const staged = await Helper.pick(staging, { tag: 'final' })
  ok(staged.success, 'stage succeeded')

  comment('seeding')
  const seeding = helper.seed({ channel: `test-${id}`, name: `test-${id}`, dir, key: null, cmdArgs: [] })
  teardown(() => Helper.teardownStream(seeding))
  const until = await Helper.pick(seeding, [{ tag: 'key' }, { tag: 'announced' }])
  const announced = await until.announced
  ok(announced, 'seeding is announced')

  const key = await until.key
  ok(hypercoreid.isValid(key), 'app key is valid')

  const link = `pear://${key}`
  const run = await Helper.run({ link })

  const result = await Helper.untilResult(run.pipe)
  is(result.trim(), 'This is the content of the asset', 'Read asset from entrypoint')

  await Helper.untilClose(run.pipe)
  ok(true, 'ended')
})

test('app with assets in sub dep', async function ({ ok, is, plan, comment, teardown, timeout }) {
  timeout(180000)
  plan(5)

  const dir = subDepRequireAssets

  const helper = new Helper()
  teardown(() => helper.close(), { order: Infinity })
  await helper.ready()

  const id = Helper.getRandomId()

  comment('staging')
  const staging = helper.stage({ channel: `test-${id}`, name: `test-${id}`, dir, dryRun: false })
  teardown(() => Helper.teardownStream(staging))
  const staged = await Helper.pick(staging, { tag: 'final' })
  ok(staged.success, 'stage succeeded')

  comment('seeding')
  const seeding = helper.seed({ channel: `test-${id}`, name: `test-${id}`, dir, key: null, cmdArgs: [] })
  teardown(() => Helper.teardownStream(seeding))
  const until = await Helper.pick(seeding, [{ tag: 'key' }, { tag: 'announced' }])
  const announced = await until.announced
  ok(announced, 'seeding is announced')

  const key = await until.key
  ok(hypercoreid.isValid(key), 'app key is valid')

  const link = `pear://${key}`
  const run = await Helper.run({ link })

  const result = await Helper.untilResult(run.pipe)
  is(result.trim(), 'This is the content of the asset', 'Read asset from entrypoint')

  await Helper.untilClose(run.pipe)
  ok(true, 'ended')
})

test('local app', async function ({ ok, is, teardown }) {
  const helper = new Helper()
  teardown(() => helper.close(), { order: Infinity })
  await helper.ready()

  const tmpdir = await tmp()
  const from = new LocalDrive(versionsDir)
  const to = new LocalDrive(tmpdir)

  const mirror = from.mirror(to)
  await mirror.done()

  const run = await Helper.run({ link: tmpdir })
  const result = await Helper.untilResult(run.pipe)
  const versions = JSON.parse(result)
  is(versions.app.key, null, 'app key is null')
  await Helper.untilClose(run.pipe)

  const data = await helper.data({ resource: 'apps', link: tmpdir })
  const dataResult = await Helper.pick(data, [{ tag: 'apps' }])
  const bundle = (await dataResult.apps)[0]
  is(bundle.link, pathToFileURL(tmpdir).href, 'href of the directory is the app bundle key')
  ok(bundle.appStorage.includes('by-random'), 'application by storage has been generate randomly and persisted')
  is(bundle.encryptionKey, undefined, 'application has no encryption key')

  ok(true, 'ended')
})

test('entrypoint and fragment', async function ({ is, plan, comment, teardown, timeout }) {
  timeout(180000)
  plan(2)

  const dir = entrypointAndFragment
  const entrypoint = '/entrypoint.js'
  const fragment = (Helper.getRandomId()).toString()

  const helper = new Helper()
  teardown(() => helper.close(), { order: Infinity })
  await helper.ready()

  const id = Helper.getRandomId()

  comment('staging')
  const staging = helper.stage({ channel: `test-${id}`, name: `test-${id}`, dir, dryRun: false, bare: true })
  teardown(() => Helper.teardownStream(staging))
  const staged = await Helper.pick(staging, [{ tag: 'addendum' }, { tag: 'final' }])
  const { key } = await staged.addendum
  await staged.final

  const link = `pear://${key}${entrypoint}#${fragment}`
  const run = await Helper.run({ link })

  const result = await Helper.untilResult(run.pipe)
  const info = JSON.parse(result)

  is(info.entrypoint, entrypoint)
  is(info.fragment, fragment)

  await Helper.untilClose(run.pipe)
})

test('double stage and Pear.versions', async ({ teardown, comment, ok, is }) => {
  const helper = new Helper()
  teardown(() => helper.close(), { order: Infinity })
  await helper.ready()

  const tmpdir = await tmp()
  const id = Helper.getRandomId()

  const from = new LocalDrive(versionsDir)
  const to = new LocalDrive(tmpdir)

  const mirror = from.mirror(to)
  await mirror.done()

  const makeIndex = (version) => `const pipe = require('pear-pipe')()
  Pear.versions().then((versions) => {
    pipe.write(JSON.stringify({ version: '${version}', ...versions }) + '\\n')
  })
`
  await to.put('/index.js', makeIndex('A'))

  comment('staging A')
  const stagingA = helper.stage({ channel: `test-${id}`, name: `test-${id}`, dir: tmpdir, dryRun: false })
  teardown(() => Helper.teardownStream(stagingA))
  const stagedA = await Helper.pick(stagingA, [{ tag: 'addendum' }, { tag: 'final' }])
  const addendumA = await stagedA.addendum
  const lengthA = addendumA.version
  await stagedA.final

  const link = `pear://${addendumA.key}`

  const runA = await Helper.run({ link })
  const resultA = await Helper.untilResult(runA.pipe)
  const infoA = JSON.parse(resultA)
  await Helper.untilClose(runA.pipe)
  is(infoA.version, 'A')

  comment('staging B')
  await to.put('/index.js', makeIndex('B'))
  const stagingB = helper.stage({ channel: `test-${id}`, name: `test-${id}`, dir: tmpdir, dryRun: false })
  teardown(() => Helper.teardownStream(stagingB))
  const stagedB = await Helper.pick(stagingB, [{ tag: 'addendum' }, { tag: 'final' }])
  const addendumB = await stagedB.addendum
  const lengthB = addendumB.version
  await stagedB.final

  ok(lengthA < lengthB)

  // runAA Needed for update
  const runAA = await Helper.run({ link })
  await Helper.untilResult(runAA.pipe)
  await Helper.untilClose(runAA.pipe)

  const runB = await Helper.run({ link })
  const resultB = await Helper.untilResult(runB.pipe)
  const infoB = JSON.parse(resultB)
  await Helper.untilClose(runB.pipe)
  is(infoB.version, 'B')

  const run = await Helper.run({ link: `pear://0.${lengthA}.${addendumA.key}` })
  const result = await Helper.untilResult(run.pipe)
  const info = JSON.parse(result)
  await Helper.untilClose(run.pipe)

  is(info.version, 'A')
  is(info.app.length, lengthA)
})

test('routes and linkdata', async ({ teardown, comment, ok, is }) => {
  const dir = routesDir

  const helper = new Helper()
  teardown(() => helper.close(), { order: Infinity })
  await helper.ready()

  const id = Helper.getRandomId()

  comment('staging')
  const staging = helper.stage({ channel: `test-${id}`, name: `test-${id}`, dir, dryRun: false })
  teardown(() => Helper.teardownStream(staging))
  const staged = await Helper.pick(staging, { tag: 'final' })
  ok(staged.success, 'stage succeeded')

  comment('seeding')
  const seeding = helper.seed({ channel: `test-${id}`, name: `test-${id}`, dir, key: null, cmdArgs: [] })
  teardown(() => Helper.teardownStream(seeding))
  const until = await Helper.pick(seeding, [{ tag: 'key' }, { tag: 'announced' }])
  const announced = await until.announced
  ok(announced, 'seeding is announced')

  const key = await until.key
  ok(hypercoreid.isValid(key), 'app key is valid')

  const linkData = 'link-data'
  const link = `pear://${key}/${linkData}`
  const run = await Helper.run({ link })

  const result = await Helper.untilResult(run.pipe)
  await Helper.untilClose(run.pipe)
  is(result, linkData)

  const routeLink = `pear://${key}/subdir/index.js`
  const routeRun = await Helper.run({ link: routeLink })
  const expected = 'this-is-subdir'
  const routeResult = await Helper.untilResult(routeRun.pipe)
  is(routeResult, expected)
  await Helper.untilClose(routeRun.pipe)
})
