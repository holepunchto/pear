'use strict'
const test = require('brittle')
const path = require('bare-path')
const hid = require('hypercore-id-encoding')
const Helper = require('./helper')

test('blind peer should serve and not announce when untrusted client adds a core', async function ({
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
  const serverMsgs = await Helper.pick(serverStream, [
    { tag: 'add-core' },
    { tag: 'listening' },
    { tag: 'downgrade-announce' }
  ])
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
  await execution(serverMsgs['downgrade-announce'], 'server emits downgrade-announce')

  const result = await seeding
  absent(result.announce, 'should not announce to untrusted peer')
})

test('blind peer should serve with trusted keys and announce when trusted client adds a core', async function ({
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
    const { final } = await Helper.pick(clientIdentityStream, [{ tag: 'final' }])
    clientPubKey = (await final).publicKey
    await Helper.teardownStream(clientIdentityStream)
  }

  const server = new Helper()
  teardown(() => server.close(), { order: Infinity })
  await server.ready()

  const otherTrustedKey = Helper.getRandomId()
  const serverStream = server.blindPeer({
    subcommand: 'start',
    data: { trustedPeers: [otherTrustedKey, clientPubKey] }
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

test('blind peer should restart after stopping previous instance', async function ({
  teardown,
  plan,
  ok
}) {
  plan(2)

  {
    const server = new Helper()
    teardown(() => server.close(), { order: Infinity })
    await server.ready()

    const serverStream = server.blindPeer({ subcommand: 'start' })
    serverStream.on('error', () => {})
    teardown(() => Helper.teardownStream(serverStream))
    const { listening } = await Helper.pick(serverStream, [{ tag: 'listening' }])
    ok((await listening).publicKey, 'first blind peer started')

    await Helper.teardownStream(serverStream)
    await server.close()
  }

  {
    const server = new Helper()
    teardown(() => server.close(), { order: Infinity })
    await server.ready()

    const serverStream = server.blindPeer({ subcommand: 'start' })
    serverStream.on('error', () => {})
    teardown(() => Helper.teardownStream(serverStream))
    const { listening } = await Helper.pick(serverStream, [{ tag: 'listening' }])
    ok((await listening).publicKey, 'second blind peer started after previous closed')
  }
})

test('blind peer should reject invalid subcommand and missing parameters', async function ({
  teardown,
  plan,
  exception
}) {
  plan(3)

  const helper = new Helper()
  teardown(() => helper.close(), { order: Infinity })
  await helper.ready()

  {
    const stream = helper.blindPeer({ subcommand: 'invalid_subcommand' })
    teardown(() => Helper.teardownStream(stream))
    await exception(
      Helper.pick(stream, { tag: 'final' }),
      /Unknown subcommand: invalid_subcommand/,
      'rejects unknown subcommand'
    )
  }

  {
    const stream = helper.blindPeer({
      subcommand: 'request',
      data: { peerKey: Helper.getRandomId() }
    })
    teardown(() => Helper.teardownStream(stream))
    await exception(
      Helper.pick(stream, { tag: 'seeding' }),
      /A core key must be specified/,
      'rejects request without key'
    )
  }

  {
    const stream = helper.blindPeer({
      subcommand: 'request',
      data: { key: Helper.getRandomId() }
    })
    teardown(() => Helper.teardownStream(stream))
    await exception(
      Helper.pick(stream, { tag: 'seeding' }),
      /A blind peer key must be specified/,
      'rejects request without peerKey'
    )
  }
})

test('blind peer should download and sync core data from trusted client', async function ({
  teardown,
  plan,
  is,
  execution
}) {
  plan(5)

  const client = new Helper()
  teardown(() => client.close(), { order: Infinity })
  await client.ready()

  let clientPubKey
  {
    const clientIdentityStream = client.blindPeer({ subcommand: 'identity' })
    teardown(() => Helper.teardownStream(clientIdentityStream))
    const { final } = await Helper.pick(clientIdentityStream, [{ tag: 'final' }])
    clientPubKey = (await final).publicKey
    await Helper.teardownStream(clientIdentityStream)
  }

  const server = new Helper()
  teardown(() => server.close(), { order: Infinity })
  await server.ready()

  const serverStream = server.blindPeer({
    subcommand: 'start',
    data: { trustedPeers: [clientPubKey] }
  })
  teardown(() => Helper.teardownStream(serverStream))
  const serverMsgs = await Helper.pick(serverStream, [
    { tag: 'listening' },
    { tag: 'add-core' },
    { tag: 'announce-core' },
    { tag: 'core-downloaded' }
  ])
  const { publicKey: peerKey } = await serverMsgs.listening

  const link = await Helper.touchLink(client)
  const staging = client.stage({
    link,
    dir: Helper.fixture('versions'),
    dryRun: false
  })
  teardown(() => Helper.teardownStream(staging))
  const staged = await Helper.pick(staging, [{ tag: 'final' }])
  await staged.final

  const seedingClient = client.seed({ link })
  teardown(() => Helper.teardownStream(seedingClient))
  const seeded = await Helper.pick(seedingClient, [{ tag: 'announced' }, { tag: 'peer-add' }])
  await seeded.announced

  const coreKey = hid.normalize(hid.decode(link))
  const requestStream = client.blindPeer({
    subcommand: 'request',
    data: { key: coreKey, peerKey }
  })
  teardown(() => Helper.teardownStream(requestStream))

  const seeding = Helper.pick(requestStream, { tag: 'seeding' })

  await execution(serverMsgs['add-core'], 'server receives add-core request')
  await execution(seeding, 'client receives seeding confirmation')
  await execution(seeded['peer-add'], 'client receives peer-add on seed')
  is(hid.normalize(await seeded['peer-add']), peerKey, 'connected peer matches blind peer key')
  const downloaded = await serverMsgs['core-downloaded']
  is(downloaded.key, coreKey, 'blind peer downloaded core data')
})

const rig = new Helper.Rig({ dir: path.join(Helper.tmp, 'blind-peer-pear') })
const unhookBlindPeerIdentity = test.hook('blind peer identity rig setup', rig.setup)

test('blind peer identity should persist between sidecar restarts', async function ({
  teardown,
  plan,
  is
}) {
  plan(1)

  let identity1
  {
    const helper = new Helper(rig)
    teardown(() => helper.close(), { order: Infinity })
    await helper.ready()

    const identityStream = helper.blindPeer({ subcommand: 'identity' })
    teardown(() => Helper.teardownStream(identityStream))
    const { final } = await Helper.pick(identityStream, [{ tag: 'final' }])
    identity1 = (await final).publicKey
    await Helper.teardownStream(identityStream)

    await helper.shutdown()
    helper.close()

    await Helper.untilExit(helper.child)
  }

  let identity2
  {
    const helper = new Helper(rig)
    teardown(() => helper.close(), { order: Infinity })
    await helper.ready()

    const identityStream = helper.blindPeer({ subcommand: 'identity' })
    teardown(() => Helper.teardownStream(identityStream))
    const { final } = await Helper.pick(identityStream, [{ tag: 'final' }])
    identity2 = (await final).publicKey
    await Helper.teardownStream(identityStream)

    await helper.shutdown()
    helper.close()
  }

  is(identity1, identity2, 'blind peer identity remains the same after restart')
})

unhookBlindPeerIdentity('blind peer identity rig cleanup', rig.cleanup)
