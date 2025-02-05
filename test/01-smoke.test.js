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

test('dht bootstrap', async function ({ ok, alike, plan, comment, teardown, timeout }) {
  timeout(180000)
  plan(5)

  const dir = dhtBootstrapDir

  const helper = new Helper()
  teardown(() => helper.close(), { order: Infinity })
  await helper.ready()

  const id = Math.floor(Math.random() * 10000)

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
})

test('storage', async function ({ ok, is, plan, comment, teardown, timeout }) {
  timeout(180000)
  plan(4)

  const dir = storageDir

  const testAppStorage = Pear.config.storage
  ok(testAppStorage.includes('by-random'))

  const helper = new Helper()
  teardown(() => helper.close(), { order: Infinity })
  await helper.ready()

  const id = Math.floor(Math.random() * 10000)

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
})

test('versions', async function ({ ok, is, plan, comment, teardown, timeout }) {
  timeout(180000)
  plan(5)

  const dir = versionsDir

  const helper = new Helper()
  teardown(() => helper.close(), { order: Infinity })
  await helper.ready()

  const id = Math.floor(Math.random() * 10000)

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
})

test('app with assets', async function ({ ok, is, plan, comment, teardown, timeout }) {
  timeout(180000)
  plan(5)

  const dir = requireAssets

  const helper = new Helper()
  teardown(() => helper.close(), { order: Infinity })
  await helper.ready()

  const id = Math.floor(Math.random() * 10000)

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

  const id = Math.floor(Math.random() * 10000)

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
