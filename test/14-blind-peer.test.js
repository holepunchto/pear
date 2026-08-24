'use strict'
const test = require('brittle')
const hid = require('hypercore-id-encoding')
const Helper = require('./helper')

test('blind peer serves and untrusted client adds a core', async function ({
  teardown,
  plan,
  execution,
  absent
}) {
  plan(3)

  const server = new Helper()
  teardown(() => server.close(), { order: Infinity })
  await server.ready()

  const serverStream = server.blindPeer({ subcommand: 'start' })
  teardown(() => Helper.teardownStream(serverStream))
  const serverMsgs = await Helper.pick(serverStream, [{ tag: 'add-core' }, { tag: 'listening' }])
  const { publicKey: peerKey } = await serverMsgs.listening

  const client = new Helper()
  teardown(() => client.close(), { order: Infinity })
  await client.ready()

  const coreKey = Helper.getRandomId()
  const requestStream = client.blindPeer({
    subcommand: 'request',
    data: { key: coreKey, peerKey }
  })
  teardown(() => Helper.teardownStream(requestStream))

  const seeding = Helper.pick(requestStream, { tag: 'seeding' })

  await execution(serverMsgs['add-core'], 'server receives add-core request')
  await execution(seeding, 'client receives seeding')

  const result = await seeding
  absent(result.announce, 'should not announce to untrusted peer')
})

test('blind peer serves with a trusted key and trusted client adds a core', async function ({
  teardown,
  plan,
  is,
  ok,
  execution
}) {
  plan(4)

  const client = new Helper()
  teardown(() => client.close(), { order: Infinity })
  await client.ready()

  let clientPubKey
  {
    const clientIdentityStream = client.blindPeer({ subcommand: 'identity' })
    teardown(() => Helper.teardownStream(clientIdentityStream))
    const clientMsgs = await Helper.pick(clientIdentityStream, [{ tag: 'final' }])
    clientPubKey = (await clientMsgs.final).publicKey
    await Helper.teardownStream(clientIdentityStream)
  }

  const server = new Helper()
  teardown(() => server.close(), { order: Infinity })
  await server.ready()

  const serverStream = server.blindPeer({
    subcommand: 'start',
    data: { trustedPeer: clientPubKey }
  })
  teardown(() => Helper.teardownStream(serverStream))
  const serverMsgs = await Helper.pick(serverStream, [{ tag: 'add-core' }, { tag: 'listening' }])
  const { publicKey: peerKey } = await serverMsgs.listening

  const coreKey = hid.normalize(Helper.getRandomId())
  const requestStream = client.blindPeer({
    subcommand: 'request',
    data: { key: coreKey, peerKey }
  })
  teardown(() => Helper.teardownStream(requestStream))

  const seeding = await Helper.pick(requestStream, { tag: 'seeding' })
  const seedingResult = await seeding

  await execution(serverMsgs['add-core'], 'core added')

  ok(seedingResult.announce, 'core announced')
  is(seedingResult.peerKey, peerKey, 'peer key matches')
  is(seedingResult.key, coreKey, 'core key matches')
})

test('blind peer should not start twice', async function ({ teardown, plan, exception }) {
  plan(1)

  const server = new Helper()
  teardown(() => server.close(), { order: Infinity })
  await server.ready()

  {
    const serverStream = server.blindPeer({ subcommand: 'start' })
    teardown(() => Helper.teardownStream(serverStream))
    const serverMsgs = await Helper.pick(serverStream, [{ tag: 'listening' }])
    await serverMsgs.listening
  }

  {
    const serverStream = server.blindPeer({ subcommand: 'start' })
    teardown(() => Helper.teardownStream(serverStream))
    const serverMsgs = await Helper.pick(serverStream, [{ tag: 'listening' }])
    await exception(
      serverMsgs.listening,
      /Blind peer is already running/,
      'Should fail to start blind-peer when it is already running'
    )
  }
})
