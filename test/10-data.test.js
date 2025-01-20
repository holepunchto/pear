'use strict'
const test = require('brittle')
const path = require('bare-path')
const crypto = require('hypercore-crypto')
const hypercoreid = require('hypercore-id-encoding')
const Helper = require('./helper')
const storageDir = path.join(Helper.localDir, 'test', 'fixtures', 'storage')

test('pear data', async function ({ ok, is, plan, comment, teardown, timeout }) {
  timeout(180000)
  plan(10)

  const dir = storageDir
  const helper = new Helper()
  teardown(() => helper.close(), { order: Infinity })
  await helper.ready()
  const id = Math.floor(Math.random() * 10000)
  const password = hypercoreid.encode(crypto.randomBytes(32))

  comment('staging')
  const staging = helper.stage({ channel: `test-${id}`, name: `test-${id}`, dir, dryRun: false, bare: true })
  teardown(() => Helper.teardownStream(staging))
  const staged = await Helper.pick(staging, [{ tag: 'addendum' }, { tag: 'final' }])
  const { key } = await staged.addendum
  await staged.final
  await helper.permit({ key: hypercoreid.decode(key), password })

  const link = `pear://${key}`
  const run = await Helper.run({ link })
  await Helper.untilClose(run.pipe)
  let data = await helper.data({ resource: 'apps' })

  comment('pear data apps')
  let result = await Helper.pick(data, [{ tag: 'apps' }])
  const bundles = await result.apps
  ok(bundles.length > 0, 'Bundle array exists')
  is(typeof bundles[0].link, 'string', 'Field link is a string')
  is(typeof bundles[0].appStorage, 'string', 'Field appStorage is a string')

  comment('pear data apps [link]')
  data = await helper.data({ resource: 'link', link })
  result = await Helper.pick(data, [{ tag: 'link' }])
  let bundle = await result.link
  ok(bundle.link.startsWith('pear://'), 'Link starts with pear://')
  is(bundle.link, link, 'Link matches to the one just created')
  is(typeof bundle.appStorage, 'string', 'Field appStorage is a string')

  comment('pear data --secrets apps [link]')
  data = await helper.data({ resource: 'link', link })
  result = await Helper.pick(data, [{ tag: 'link' }])
  bundle = await result.link
  ok(bundle.link.startsWith('pear://'), 'Link starts with pear://')
  is(bundle.link, link, 'Link matches to the one just created')
  is(typeof bundle.appStorage, 'string', 'Field appStorage is a string')
  is(bundle.encryptionKey, password.toString('hex'), 'Encryption key matches')

  comment('pear data dht')
  data = await helper.data({ resource: 'dht' })
  result = await Helper.pick(data, [{ tag: 'dht' }])
  const dht = await result.dht
  ok(dht.length > 0, 'DHT array exists')
  is(typeof dht[0].host, 'string', 'Field host is a string')
  is(typeof dht[0].port, 'number', 'Field port is a number')
})
