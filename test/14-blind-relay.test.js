'use strict'
const test = require('brittle')
const Helper = require('./helper')

let recordedPublicKey

test('pear blind-relay start basic', async function ({ ok, plan, teardown, timeout }) {
  timeout(180000)
  plan(14)

  const helper = new Helper()
  teardown(() => helper.close(), { order: Infinity })
  await helper.ready()

  const blindRelay = helper.blindRelay({ action: 'start' })
  teardown(() => Helper.teardownStream(blindRelay))
  const until = await Helper.pick(blindRelay, [{ tag: 'listening' }, { tag: 'stats' }])

  const { publicKey } = await until.listening
  ok(/^[a-z0-9]{52}$/.test(publicKey), 'listening on a z32 encoded public key')
  recordedPublicKey = publicKey

  const { stats } = await until.stats

  ok(Number.isInteger(stats.sessions.accepted), 'stats have accepted sessions')
  ok(Number.isInteger(stats.sessions.opened), 'stats have opened sessions')
  ok(Number.isInteger(stats.sessions.closed), 'stats have closed sessions')
  ok(Number.isInteger(stats.sessions.active), 'stats have active sessions')

  ok(Number.isInteger(stats.pairings.requested), 'stats have requested pairings')
  ok(Number.isInteger(stats.pairings.matched), 'stats have matched pairings')
  ok(Number.isInteger(stats.pairings.cancelled), 'stats have cancelled pairings')
  ok(Number.isInteger(stats.pairings.pending), 'stats have pending pairings')
  ok(Number.isInteger(stats.pairings.active), 'stats have active pairings')

  ok(Number.isInteger(stats.streams.opened), 'stats have opened streams')
  ok(Number.isInteger(stats.streams.closed), 'stats have closed streams')
  ok(Number.isInteger(stats.streams.errors), 'stats have errors streams')
  ok(Number.isInteger(stats.streams.active), 'stats have active streams')
})

test('pear blind-relay restart must have same public key', async function ({
  is,
  plan,
  teardown,
  timeout
}) {
  timeout(180000)
  plan(1)

  const helper = new Helper()
  teardown(() => helper.close(), { order: Infinity })
  await helper.ready()

  const blindRelay = helper.blindRelay({ action: 'start' })
  teardown(() => Helper.teardownStream(blindRelay))
  const until = await Helper.pick(blindRelay, [{ tag: 'listening' }])

  const { publicKey } = await until.listening
  is(publicKey, recordedPublicKey)
})
