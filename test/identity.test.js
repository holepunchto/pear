'use strict'
const test = require('brittle')
const hypercoreid = require('hypercore-id-encoding')
const Helper = require('./helper')

test('pear identity seed returns z32 key', async function ({ teardown, plan, is }) {
  plan(1)

  const helper = new Helper()
  teardown(() => helper.close(), { order: Infinity })
  await helper.ready()

  const identity = helper.identity({ type: 'seed' })
  teardown(() => Helper.teardownStream(identity))
  const { final } = await Helper.pick(identity, [{ tag: 'final' }])
  const { publicKey } = await final
  is(publicKey, hypercoreid.normalize(publicKey), 'seed identity is z32')
})

test('pear identity blind-relay returns z32 key', async function ({ teardown, plan, is }) {
  plan(1)

  const helper = new Helper()
  teardown(() => helper.close(), { order: Infinity })
  await helper.ready()

  const identity = helper.identity({ type: 'blind-relay' })
  teardown(() => Helper.teardownStream(identity))
  const { final } = await Helper.pick(identity, [{ tag: 'final' }])
  const { publicKey } = await final
  is(publicKey, hypercoreid.normalize(publicKey), 'blind-relay identity is z32')
})

test('pear identity blind-peer returns z32 key', async function ({ teardown, plan, is }) {
  plan(2)

  const helper = new Helper()
  teardown(() => helper.close(), { order: Infinity })
  await helper.ready()

  const identity = helper.identity({ type: 'blind-peer' })
  teardown(() => Helper.teardownStream(identity))
  const { final } = await Helper.pick(identity, [{ tag: 'final' }])
  const { publicKey } = await final
  is(publicKey, hypercoreid.normalize(publicKey), 'blind-peer identity is z32')

  const startStream = helper.blindPeer({ subcommand: 'start' })
  teardown(() => Helper.teardownStream(startStream))
  const { listening } = await Helper.pick(startStream, [{ tag: 'listening' }])
  is(publicKey, (await listening).publicKey, 'blind peer identity matches listening key')
})

test('pear identity blind-peer-client returns z32 key', async function ({ teardown, plan, is }) {
  plan(1)

  const helper = new Helper()
  teardown(() => helper.close(), { order: Infinity })
  await helper.ready()

  const identity = helper.identity({ type: 'blind-peer-client' })
  teardown(() => Helper.teardownStream(identity))
  const { final } = await Helper.pick(identity, [{ tag: 'final' }])
  const { publicKey } = await final
  is(publicKey, hypercoreid.normalize(publicKey), 'blind-peer-client identity is z32')
})
