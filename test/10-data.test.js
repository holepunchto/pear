'use strict'
const test = require('brittle')
const path = require('bare-path')
const hypercoreid = require('hypercore-id-encoding')
const crypto = require('hypercore-crypto')
const { isWindows } = require('which-runtime')
const Helper = require('./helper')
const deriveEncryptionKey = require('pw-to-ek')
const { SALT } = require('../constants')

const encrypted = path.join(Helper.localDir, 'test', 'fixtures', 'encrypted')
const versionsDir = path.join(Helper.localDir, 'test', 'fixtures', 'versions')

test('pear data', async function ({ ok, is, plan, comment, timeout, teardown }) {
  timeout(180000)
  plan(16)

  const dir = encrypted
  const helper = new Helper()
  teardown(() => helper.close(), { order: Infinity })
  await helper.ready()

  const id = Math.floor(Math.random() * 10000)
  const password = hypercoreid.encode(crypto.randomBytes(32))
  const ek = await deriveEncryptionKey(password, SALT)

  const touch = await helper.touch({ dir, channel: `test-${id}` })
  const { key } = await Helper.pick(touch, { tag: 'result' })
  await helper.permit({ key: hypercoreid.decode(key), password })
  const link = `pear://${key}`
  const { pipe } = await Helper.run({ link })

  comment('staging with encryption key')
  const staging = helper.stage({ channel: `test-${id}`, dir, dryRun: false })
  teardown(() => Helper.teardownStream(staging))
  const final = await Helper.pick(staging, { tag: 'final' })
  ok(final.success, 'stage succeeded')

  comment('pear data apps')
  let data = await helper.data({ resource: 'apps' })
  let result = await Helper.pick(data, [{ tag: 'apps' }])
  const bundles = await result.apps
  ok(bundles.length > 0, 'Bundle array exists')
  is(typeof bundles[0].link, 'string', 'Field link is a string')
  is(typeof bundles[0].appStorage, 'string', 'Field appStorage is a string')

  comment('pear data apps [link]')
  data = await helper.data({ resource: 'link', link })
  result = await Helper.pick(data, [{ tag: 'link' }])
  let bundle = await result.link
  ok(bundle.encryptionKey === undefined, 'Encryption key is hidden without --secrets')
  ok(bundle.link.startsWith('pear://'), 'Link starts with pear://')
  is(bundle.link, link, 'Link matches to the one just created')
  is(typeof bundle.appStorage, 'string', 'Field appStorage is a string')

  comment('pear data --secrets apps [link]')
  data = await helper.data({ resource: 'link', link, secrets: true })
  result = await Helper.pick(data, [{ tag: 'link' }])
  bundle = await result.link
  is(bundle.encryptionKey.toString('hex'), ek.toString('hex'), 'Encryption key from bundle matches')
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

  await Helper.untilClose(pipe)
  ok(true, 'ended')
})

test('no duplicated bundle', async function ({ is, comment, teardown }) {
  const dir = versionsDir

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

  const runA = await Helper.run({ link: `pear://${key}` })
  await Helper.untilClose(runA.pipe)

  const runB = await Helper.run({ link: `pear://${key}/#fragment` })
  await Helper.untilClose(runB.pipe)

  const runC = await Helper.run({ link: `pear://${key}/xeb7mugj8sbaytkf5qqu9z1snegtibqneysssdqu35em4zw3ou9wcmz8ha4er6e759tams9eeebo6j6ueifyb4oaeohnijbyxfzessxjneaqs8ux` })
  await Helper.untilClose(runC.pipe)

  const data = await helper.data({ resource: 'apps' })
  const result = await Helper.pick(data, [{ tag: 'apps' }])
  const bundles = await result.apps

  const persistedBundles = bundles.filter(e => e.link.startsWith(`pear://${key}`))
  is(persistedBundles.length, 1, 'single bundle persisted')
  is(persistedBundles[0].link, `pear://${key}`, 'bundle key is origin key')
})

test('bundle persisted with z32 encoded key', async function ({ is, comment, teardown }) {
  const dir = versionsDir

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

  const run = await Helper.run({ link: `pear://${hypercoreid.decode(key).toString('hex')}` })
  await Helper.untilClose(run.pipe)

  const data = await helper.data({ resource: 'apps' })
  const result = await Helper.pick(data, [{ tag: 'apps' }])
  const bundles = await result.apps

  const persistedBundles = bundles.filter(e => e.link.startsWith(`pear://${key}`))
  is(persistedBundles.length, 1, 'bundle persisted')
  is(persistedBundles[0].link, `pear://${key}`, 'encoded key persisted')
})

test('no duplicated bundle local app', async function ({ is, comment, teardown }) {
  const helper = new Helper()
  teardown(() => helper.close(), { order: Infinity })
  await helper.ready()

  comment(`running ${versionsDir}`)
  const runA = await Helper.run({ link: versionsDir })
  await Helper.untilClose(runA.pipe)

  comment(`running ${versionsDir}#fragment`)
  const runB = await Helper.run({ link: versionsDir + '#fragment' })
  await Helper.untilClose(runB.pipe)

  const data = await helper.data({ resource: 'apps' })
  const result = await Helper.pick(data, [{ tag: 'apps' }])
  const bundles = await result.apps

  const key = isWindows ? `file:///${versionsDir.replaceAll('\\', '/')}` : `file://${versionsDir}`
  const persistedBundles = bundles.filter(e => e.link.startsWith(key))
  is(persistedBundles.length, 1, 'single bundle persisted')
  is(persistedBundles[0].link, key, 'bundle key is origin key')
})
