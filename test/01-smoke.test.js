'use strict'
const tmp = require('test-tmp')
const test = require('brittle')
const path = require('bare-path')
const hypercoreid = require('hypercore-id-encoding')
const fs = require('bare-fs/promises')
const { pathToFileURL } = require('url-file-url')
const Helper = require('./helper')
const versionsDir = path.join(Helper.localDir, 'test', 'fixtures', 'versions')
const dhtBootstrapDir = path.join(Helper.localDir, 'test', 'fixtures', 'dht-bootstrap')
const storageDir = path.join(Helper.localDir, 'test', 'fixtures', 'storage')
const requireAssets = path.join(Helper.localDir, 'test', 'fixtures', 'require-assets')
const subDepRequireAssets = path.join(Helper.localDir, 'test', 'fixtures', 'sub-dep-require-assets')
const entrypointAndFragment = path.join(Helper.localDir, 'test', 'fixtures', 'entrypoint-and-fragment')

test('smoke', async function ({ ok, is, alike, plan, comment, teardown, timeout }) {
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
  const pkg = { name: 'tmp-app', main: 'index.js', pear: { name: 'tmp-app', type: 'terminal' } }
  await fs.writeFile(path.join(tmpdir, 'package.json'), JSON.stringify(pkg))
  await fs.copyFile(path.join(versionsDir, 'index.js'), path.join(tmpdir, 'index.js'))

  const run = await Helper.run({ link: tmpdir })
  const result = await Helper.untilResult(run.pipe)
  const versions = JSON.parse(result)
  is(versions.app.key, null, 'app key is null')
  await Helper.untilClose(run.pipe)

  const data = await helper.data({ resource: 'link', link: tmpdir })
  const dataResult = await Helper.pick(data, [{ tag: 'link' }])
  const bundle = await dataResult.link

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

test('link length', async function ({ plan, comment, teardown, ok, is }) {
  plan(2)

  const helper = new Helper()
  teardown(() => helper.close(), { order: Infinity })
  await helper.ready()

  const tmpdir = await tmp()
  const pkgA = { name: 'tmp-app-a', main: 'index.js', pear: { name: 'tmp-app', type: 'terminal' } }
  await fs.writeFile(path.join(tmpdir, 'package.json'), JSON.stringify(pkgA))
  await fs.copyFile(path.join(versionsDir, 'index.js'), path.join(tmpdir, 'index.js'))

  const id = Helper.getRandomId()

  comment('first stage')
  const stagingA = helper.stage({ channel: `test-${id}`, name: `test-${id}`, dir: tmpdir, dryRun: false })
  teardown(() => Helper.teardownStream(stagingA))
  const stagedA = await Helper.pick(stagingA, [{ tag: 'addendum' }, { tag: 'final' }])
  const { key } = await stagedA.addendum
  await stagedA.final

  const link = `pear://${key}`
  const runA = await Helper.run({ link })
  const resultA = JSON.parse(await Helper.untilResult(runA.pipe))
  await Helper.untilClose(runA.pipe)

  const pkgB = { name: 'tmp-app-b', main: 'index.js', pear: { name: 'tmp-app', type: 'terminal' } }
  await fs.writeFile(path.join(tmpdir, 'package.json'), JSON.stringify(pkgB))

  comment('second stage')
  const stagingB = helper.stage({ channel: `test-${id}`, name: `test-${id}`, dir: tmpdir, dryRun: false })
  teardown(() => Helper.teardownStream(stagingB))
  const stagedB = await Helper.pick(stagingB, [{ tag: 'final' }])
  await stagedB.final

  const runB = await Helper.run({ link })
  const resultB = JSON.parse(await Helper.untilResult(runB.pipe))
  await Helper.untilClose(runB.pipe)

  ok(resultA.app.length < resultB.app.length)

  comment('run with link + length')
  const runC = await Helper.run({ link: `pear://0.${resultA.app.length}.${key}` })
  const resultC = JSON.parse(await Helper.untilResult(runC.pipe))
  await Helper.untilClose(runC.pipe)

  is(resultA.app.length, resultC.app.length)
})
