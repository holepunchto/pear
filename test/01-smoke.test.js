'use strict'
const opwait = require('pear-opwait')
const tmp = require('test-tmp')
const test = require('brittle')
const hypercoreid = require('hypercore-id-encoding')
const Localdrive = require('localdrive')
const { pathToFileURL } = require('url-file-url')
const Helper = require('./helper')

test('smoke', async function ({ ok, is, pass, alike, plan, comment, teardown, timeout }) {
  timeout(180000)
  plan(14)

  const testVersions = async () => {
    const dir = Helper.fixture('versions')

    const helper = new Helper()
    teardown(() => helper.close(), { order: Infinity })
    await helper.ready()

    const id = Helper.getRandomId()

    comment('staging')
    const staging = helper.stage({
      link: `test-${id}`,
      name: `test-${id}`,
      dir,
      dryRun: false
    })
    teardown(() => Helper.teardownStream(staging))
    const staged = await Helper.pick(staging, { tag: 'final' })
    ok(staged.success, 'stage succeeded')

    comment('seeding')
    const seeding = helper.seed({
      link: `test-${id}`,
      name: `test-${id}`,
      dir,
      key: null,
      cmdArgs: []
    })
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
    pass('ended')
  }

  const testDhtBootstrap = async () => {
    const dir = Helper.fixture('dht-bootstrap')

    const helper = new Helper()
    teardown(() => helper.close(), { order: Infinity })
    await helper.ready()

    const id = Helper.getRandomId()

    comment('staging')
    const staging = helper.stage({
      link: `test-${id}`,
      name: `test-${id}`,
      dir,
      dryRun: false
    })
    teardown(() => Helper.teardownStream(staging))
    const staged = await Helper.pick(staging, { tag: 'final' })
    ok(staged.success, 'stage succeeded')

    comment('seeding')
    const seeding = helper.seed({
      link: `test-${id}`,
      name: `test-${id}`,
      dir,
      key: null,
      cmdArgs: []
    })
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
    alike(dhtBootstrap, Pear.app.dht.bootstrap, 'dht bootstrap matches Pear.app.dht.bootstrap')

    await Helper.untilClose(run.pipe)
    pass('ended')
  }

  const testStorage = async () => {
    const dir = Helper.fixture('storage')

    const testAppStorage = Pear.app.storage
    ok(testAppStorage.includes('by-random'))

    const helper = new Helper()
    teardown(() => helper.close(), { order: Infinity })
    await helper.ready()

    const id = Helper.getRandomId()

    comment('staging')
    const staging = helper.stage({
      link: `test-${id}`,
      name: `test-${id}`,
      dir,
      dryRun: false,
      bare: true
    })
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

    pass('ended')
  }

  await Promise.all([testVersions(), testDhtBootstrap(), testStorage()])
})

test('app with assets', async function ({ ok, is, pass, plan, comment, teardown, timeout }) {
  timeout(180000)
  plan(5)

  const dir = Helper.fixture('require-assets')

  const helper = new Helper()
  teardown(() => helper.close(), { order: Infinity })
  await helper.ready()

  const id = Helper.getRandomId()

  comment('staging')
  const staging = helper.stage({
    link: `test-${id}`,
    name: `test-${id}`,
    dir,
    dryRun: false
  })
  teardown(() => Helper.teardownStream(staging))
  const staged = await Helper.pick(staging, { tag: 'final' })
  ok(staged.success, 'stage succeeded')

  comment('seeding')
  const seeding = helper.seed({
    link: `test-${id}`,
    name: `test-${id}`,
    dir,
    key: null,
    cmdArgs: []
  })
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
  pass('ended')
})

test('app with assets in sub dep', async function ({
  ok,
  is,
  pass,
  plan,
  comment,
  teardown,
  timeout
}) {
  timeout(180000)
  plan(5)

  const dir = Helper.fixture('sub-dep-require-assets')

  const helper = new Helper()
  teardown(() => helper.close(), { order: Infinity })
  await helper.ready()

  const id = Helper.getRandomId()

  comment('staging')
  const staging = helper.stage({
    link: `test-${id}`,
    name: `test-${id}`,
    dir,
    dryRun: false
  })
  teardown(() => Helper.teardownStream(staging))
  const staged = await Helper.pick(staging, { tag: 'final' })
  ok(staged.success, 'stage succeeded')

  comment('seeding')
  const seeding = helper.seed({
    link: `test-${id}`,
    name: `test-${id}`,
    dir,
    key: null,
    cmdArgs: []
  })
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
  pass('ended')
})

test('local app', async function ({ ok, is, teardown }) {
  const helper = new Helper()
  teardown(() => helper.close(), { order: Infinity })
  await helper.ready()

  const tmpdir = await tmp()
  const from = new Localdrive(Helper.fixture('versions'))
  const to = new Localdrive(tmpdir)

  const mirror = from.mirror(to)
  await mirror.done()

  const run = await Helper.run({ link: tmpdir })
  const result = await Helper.untilResult(run.pipe)
  const versions = JSON.parse(result)
  is(versions.app.key, null, 'app key is null')
  await Helper.untilClose(run.pipe)

  const data = await helper.data({ resource: 'apps', link: tmpdir })
  const appsResult = await opwait(data)
  const bundle = appsResult.data[0]
  is(bundle.link, pathToFileURL(tmpdir).href, 'href of the directory is the app bundle key')
  ok(
    bundle.appStorage.includes('by-random'),
    'application by storage has been generate randomly and persisted'
  )
  is(bundle.encryptionKey, undefined, 'application has no encryption key')
})
