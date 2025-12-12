'use strict'
const test = require('brittle')
const hypercoreid = require('hypercore-id-encoding')
const crypto = require('hypercore-crypto')
const { isWindows } = require('which-runtime')
const deriveEncryptionKey = require('pw-to-ek')
const { SALT } = require('pear-constants')
const Helper = require('./helper')

test('pear data', async function ({
  ok,
  is,
  plan,
  pass,
  comment,
  timeout,
  teardown
}) {
  timeout(180000)
  plan(17)

  const dir = Helper.fixture('encrypted')
  const helper = new Helper()
  teardown(() => helper.close(), { order: Infinity })
  await helper.ready()

  const id = Helper.getRandomId()
  const password = hypercoreid.encode(crypto.randomBytes(32))
  const ek = await deriveEncryptionKey(password, SALT)

  const touch = await helper.touch({ dir, channel: `test-${id}` })
  const { key } = await Helper.pick(touch, { tag: 'result' })
  await helper.permit({ key: hypercoreid.decode(key), password })

  comment('staging with encryption key')
  const staging = helper.stage({ channel: `test-${id}`, dir, dryRun: false })
  teardown(() => Helper.teardownStream(staging))
  const final = await Helper.pick(staging, { tag: 'final' })
  ok(final.success, 'stage succeeded')

  const link = `pear://${key}`
  const { pipe } = await Helper.run({ link })
  await Helper.untilClose(pipe)
  pass('App has finished running')

  comment('pear data apps')
  let data = await helper.data({ resource: 'apps' })
  let result = await Helper.pick(data, [{ tag: 'apps' }])
  const bundles = await result.apps
  ok(bundles.length > 0, 'Bundle array exists')
  is(typeof bundles[0].link, 'string', 'Field link is a string')
  is(typeof bundles[0].appStorage, 'string', 'Field appStorage is a string')

  comment('pear data apps [link]')
  data = await helper.data({ resource: 'apps', link })
  result = await Helper.pick(data, [{ tag: 'apps' }])
  let bundle = (await result.apps)[0]
  ok(
    bundle.encryptionKey === undefined,
    'Encryption key is hidden without --secrets'
  )
  ok(bundle.link.startsWith('pear://'), 'Link starts with pear://')
  is(bundle.link, link, 'Link matches to the one just created')
  is(typeof bundle.appStorage, 'string', 'Field appStorage is a string')

  comment('pear data --secrets apps [link]')
  data = await helper.data({ resource: 'apps', link, secrets: true })
  result = await Helper.pick(data, [{ tag: 'apps' }])
  bundle = (await result.apps)[0]
  is(
    bundle.encryptionKey.toString('hex'),
    ek.toString('hex'),
    'Encryption key from bundle matches'
  )
  ok(bundle.link.startsWith('pear://'), 'Link starts with pear://')
  is(bundle.link, link, 'Link matches to the one just created')
  is(typeof bundle.appStorage, 'string', 'Field appStorage is a string')

  comment('pear data dht')
  data = await helper.data({ resource: 'dht' })
  result = await Helper.pick(data, [{ tag: 'dht' }])
  const dht = await result.dht
  ok(dht.length > 0, 'DHT array exists')
  is(typeof dht[0].host, 'string', 'Field host is a string')
  is(typeof dht[0].port, 'number', 'Field port is a number')

  comment('pear data manifest')
  data = await helper.data({ resource: 'manifest' })
  result = await Helper.pick(data, [{ tag: 'manifest' }])
  const manifest = await result.manifest
  is(manifest, null, 'Manifest does not exist yet')
})

test('pear data no duplicated bundle', async function ({
  is,
  comment,
  teardown
}) {
  const dir = Helper.fixture('versions')

  const helper = new Helper()
  teardown(() => helper.close(), { order: Infinity })
  await helper.ready()

  const id = Helper.getRandomId()

  comment('staging')
  const staging = helper.stage({
    channel: `test-${id}`,
    name: `test-${id}`,
    dir,
    dryRun: false,
    bare: true
  })
  teardown(() => Helper.teardownStream(staging))
  const staged = await Helper.pick(staging, [
    { tag: 'addendum' },
    { tag: 'final' }
  ])
  const { key } = await staged.addendum
  await staged.final

  const runA = await Helper.run({ link: `pear://${key}` })
  await Helper.untilClose(runA.pipe)

  const runB = await Helper.run({ link: `pear://${key}/#fragment` })
  await Helper.untilClose(runB.pipe)

  const data = await helper.data({ resource: 'apps' })
  const result = await Helper.pick(data, [{ tag: 'apps' }])
  const bundles = await result.apps

  const persistedBundles = bundles.filter((e) =>
    e.link.startsWith(`pear://${key}`)
  )
  is(persistedBundles.length, 1, 'single bundle persisted')
  is(persistedBundles[0].link, `pear://${key}`, 'bundle key is origin key')
})

test('pear data bundle persisted with z32 encoded key', async function ({
  is,
  comment,
  teardown
}) {
  const dir = Helper.fixture('versions')

  const helper = new Helper()
  teardown(() => helper.close(), { order: Infinity })
  await helper.ready()

  const id = Helper.getRandomId()

  comment('staging')
  const staging = helper.stage({
    channel: `test-${id}`,
    name: `test-${id}`,
    dir,
    dryRun: false,
    bare: true
  })
  teardown(() => Helper.teardownStream(staging))
  const staged = await Helper.pick(staging, [
    { tag: 'addendum' },
    { tag: 'final' }
  ])
  const { key } = await staged.addendum
  await staged.final

  const run = await Helper.run({
    link: `pear://${hypercoreid.decode(key).toString('hex')}`
  })
  await Helper.untilClose(run.pipe)

  const data = await helper.data({ resource: 'apps' })
  const result = await Helper.pick(data, [{ tag: 'apps' }])
  const bundles = await result.apps

  const persistedBundles = bundles.filter((e) =>
    e.link.startsWith(`pear://${key}`)
  )
  is(persistedBundles.length, 1, 'bundle persisted')
  is(persistedBundles[0].link, `pear://${key}`, 'encoded key persisted')
})

test('pear data no duplicated bundle local app', async function ({
  is,
  comment,
  teardown
}) {
  const helper = new Helper()
  teardown(() => helper.close(), { order: Infinity })
  await helper.ready()
  const dir = Helper.fixture('versions')
  comment(`running ${dir}`)
  const runA = await Helper.run({ link: dir })
  await Helper.untilClose(runA.pipe)

  comment(`running ${dir}#fragment`)
  const runB = await Helper.run({ link: dir + '#fragment' })
  await Helper.untilClose(runB.pipe)

  comment(`running file://${dir}`)
  const runC = await Helper.run({ link: 'file://' + dir })
  await Helper.untilClose(runC.pipe)

  const data = await helper.data({ resource: 'apps' })
  const result = await Helper.pick(data, [{ tag: 'apps' }])
  const bundles = await result.apps

  const key = isWindows
    ? `file:///${dir.replaceAll('\\', '/')}`
    : `file://${dir}`
  const persistedBundles = bundles.filter((e) => e.link.startsWith(key))
  is(persistedBundles.length, 1, 'single bundle persisted')
  is(persistedBundles[0].link, key, 'bundle key is origin key')
})
