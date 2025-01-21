'use strict'
const test = require('brittle')
const path = require('bare-path')
const hypercoreid = require('hypercore-id-encoding')
const crypto = require('hypercore-crypto')
const Helper = require('./helper')
const encrypted = path.join(Helper.localDir, 'test', 'fixtures', 'encrypted')

test('pear data', async function ({ ok, is, comment, timeout, teardown }) {
  timeout(180000)

  const dir = encrypted
  const helper = new Helper()
  teardown(() => helper.close(), { order: Infinity })
  await helper.ready()

  const id = Math.floor(Math.random() * 10000)
  const password = hypercoreid.encode(crypto.randomBytes(32))
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
  is(hypercoreid.encode(bundle.encryptionKey), password, 'Encryption key matches')
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
