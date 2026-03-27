'use strict'
const test = require('brittle')
const opwait = require('pear-opwait')
const Helper = require('./helper')

test('pear data dht', async function ({ ok, is, teardown }) {
  const helper = new Helper()
  teardown(() => helper.close(), { order: Infinity })
  await helper.ready()

  const data = await helper.data({ resource: 'dht' })
  const result = await opwait(data)
  const dht = await result.nodes
  ok(dht.length > 0, 'DHT array exists')
  is(typeof dht[0].host, 'string', 'Field host is a string')
  is(typeof dht[0].port, 'number', 'Field port is a number')
})

test('pear data manifest', async function ({ is, teardown }) {
  const helper = new Helper()
  teardown(() => helper.close(), { order: Infinity })
  await helper.ready()

  const data = await helper.data({ resource: 'manifest' })
  const result = await opwait(data)
  const manifest = await result.manifest
  is(manifest, null, 'Manifest does not exist in test context')
})

test('pear data multisig', async function ({ ok, teardown }) {
  const helper = new Helper()
  teardown(() => helper.close(), { order: Infinity })
  await helper.ready()

  const data = await helper.data({ resource: 'multisig' })
  const result = await opwait(data)
  ok(Array.isArray(result.records), 'Multisig records are an array')
})
