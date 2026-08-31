'use strict'
const test = require('brittle')
const path = require('bare-path')
const hid = require('hypercore-id-encoding')
const Helper = require('./helper')

const rig = new Helper.Rig({ dir: path.join(Helper.tmp, 'blind-peer-pear') })
const unhookBlindPeer = test.hook('blind peer rig setup', rig.setup)

async function shutdownAndGc(client, child = client?.child, targetRig = rig) {
  if (client) {
    await client.shutdown().catch(() => {})
    client.close()
  }
  if (child) await Helper.untilExit(child)
  await Helper.gc(path.join(targetRig.platformDir, 'blind-peer'))
}

function withTimeout(promise, ms = 3000, message = 'Operation timed out') {
  let timeoutId
  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(message)), ms)
  })
  return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timeoutId))
}

test('blind peer should serve and not announce when untrusted client adds a core', async function ({
  teardown,
  plan,
  absent,
  execution,
  exception
}) {
  plan(5)

  const client = new Helper(rig)
  teardown(() => shutdownAndGc(client), { order: Infinity })
  await client.ready()

  const link = await Helper.touchLink(client)
  const coreKey = hid.normalize(hid.decode(link))

  const server = new Helper(rig)
  teardown(() => server.close(), { order: Infinity })
  await server.ready()

  const serverStream = server.blindPeer({ subcommand: 'start' })
  teardown(() => Helper.teardownStream(serverStream))

  const serverMsgs = await Helper.pick(serverStream, [
    { tag: 'add-core', data: { key: coreKey } },
    { tag: 'listening' },
    { tag: 'add-cores-downgrade-announce' },
    { tag: 'announce-core', data: { key: coreKey } }
  ])
  const { publicKey: peerKey } = await serverMsgs.listening

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
  const seeded = await Helper.pick(seedingClient, [{ tag: 'announced' }])
  await seeded.announced

  const requestStream = client.blindPeer({
    subcommand: 'request',
    data: { key: coreKey, peerKey }
  })
  teardown(() => Helper.teardownStream(requestStream))

  const seeding = Helper.pick(requestStream, { tag: 'final' })

  await execution(serverMsgs['add-core'], 'server receives add-core request')
  await execution(
    serverMsgs['add-cores-downgrade-announce'],
    'server emits add-cores-downgrade-announce'
  )
  const addCore = await serverMsgs['add-core']
  absent(addCore.announce, 'server should not announce untrusted peer core')
  await execution(seeding, 'client receives seeding')

  await Helper.teardownStream(serverStream)
  await exception(
    serverMsgs['announce-core'],
    'server does not emit announce-core for untrusted peer'
  )
})

test('blind peer should serve with trusted keys and announce when trusted client adds a core', async function ({
  teardown,
  plan,
  is,
  ok,
  execution
}) {
  plan(5)

  const client = new Helper(rig)
  teardown(() => shutdownAndGc(client), { order: Infinity })
  await client.ready()

  let clientPubKey
  {
    const clientIdentityStream = client.blindPeer({ subcommand: 'identity' })
    teardown(() => Helper.teardownStream(clientIdentityStream))
    const { final } = await Helper.pick(clientIdentityStream, [{ tag: 'final' }])
    clientPubKey = (await final).publicKey
    await Helper.teardownStream(clientIdentityStream)
  }

  const server = new Helper(rig)
  teardown(() => server.close(), { order: Infinity })
  await server.ready()

  const link = await Helper.touchLink(client)
  const coreKey = hid.normalize(hid.decode(link))

  const otherTrustedKey = Helper.getRandomId()
  const serverStream = server.blindPeer({
    subcommand: 'start',
    data: { trustedPeers: [otherTrustedKey, clientPubKey] }
  })
  teardown(() => Helper.teardownStream(serverStream))
  const serverMsgs = await Helper.pick(serverStream, [
    { tag: 'add-core', data: { key: coreKey } },
    { tag: 'listening' },
    { tag: 'announce-core', data: { key: coreKey } }
  ])
  const { publicKey: peerKey } = await serverMsgs.listening

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
  const seeded = await Helper.pick(seedingClient, [{ tag: 'announced' }])
  await seeded.announced

  const requestStream = client.blindPeer({
    subcommand: 'request',
    data: { key: coreKey, peerKey }
  })
  teardown(() => Helper.teardownStream(requestStream))

  const seeding = await Helper.pick(requestStream, { tag: 'final' })
  const seedingResult = await seeding

  await execution(serverMsgs['add-core'], 'core added')
  await execution(serverMsgs['announce-core'], 'core announced on server')

  ok(seedingResult.announce, 'core announced')
  is(seedingResult.peerKey, peerKey, 'peer key matches')
  is(seedingResult.key, coreKey, 'core key matches')
})

test('blind peer should not start twice', async function ({ teardown, plan, exception }) {
  plan(1)

  const server = new Helper(rig)
  teardown(() => shutdownAndGc(server), { order: Infinity })
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

  let child
  let server
  {
    server = new Helper(rig)
    teardown(() => shutdownAndGc(server, child), { order: Infinity })
    await server.ready()
    child = server.child

    const serverStream = server.blindPeer({ subcommand: 'start' })
    serverStream.on('error', () => {})
    teardown(() => Helper.teardownStream(serverStream))
    const { listening } = await Helper.pick(serverStream, [{ tag: 'listening' }])
    ok((await listening).publicKey, 'first blind peer started')

    await Helper.teardownStream(serverStream)
    await server.close()
  }

  {
    server = new Helper(rig)
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

  const helper = new Helper(rig)
  teardown(() => shutdownAndGc(helper), { order: Infinity })
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
  plan(6)

  const client = new Helper(rig)
  teardown(() => shutdownAndGc(client), { order: Infinity })
  await client.ready()

  let clientPubKey
  {
    const clientIdentityStream = client.blindPeer({ subcommand: 'identity' })
    teardown(() => Helper.teardownStream(clientIdentityStream))
    const { final } = await Helper.pick(clientIdentityStream, [{ tag: 'final' }])
    clientPubKey = (await final).publicKey
    await Helper.teardownStream(clientIdentityStream)
  }

  const link = await Helper.touchLink(client)
  const coreKey = hid.normalize(hid.decode(link))

  const server = new Helper(rig)
  teardown(() => server.close(), { order: Infinity })
  await server.ready()

  const serverStream = server.blindPeer({
    subcommand: 'start',
    data: { trustedPeers: [clientPubKey] }
  })
  teardown(() => Helper.teardownStream(serverStream))
  const serverMsgs = await Helper.pick(serverStream, [
    { tag: 'listening' },
    { tag: 'add-core', data: { key: coreKey } },
    { tag: 'announce-core', data: { key: coreKey } },
    { tag: 'core-downloaded', data: { key: coreKey } }
  ])
  const { publicKey: peerKey } = await serverMsgs.listening

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

  const requestStream = client.blindPeer({
    subcommand: 'request',
    data: { key: coreKey, peerKey }
  })
  teardown(() => Helper.teardownStream(requestStream))

  const seeding = Helper.pick(requestStream, { tag: 'final' })

  await execution(serverMsgs['add-core'], 'server receives add-core request')
  await execution(serverMsgs['announce-core'], 'server announced core')
  await execution(seeding, 'client receives seeding confirmation')
  await execution(seeded['peer-add'], 'client receives peer-add on seed')
  is(hid.normalize(await seeded['peer-add']), peerKey, 'connected peer matches blind peer key')
  const downloaded = await serverMsgs['core-downloaded']
  is(downloaded.key, coreKey, 'blind peer downloaded core data')
})

const hostRig = new Helper.Rig({ dir: path.join(Helper.tmp, 'host-pear') })
const unhookHost = test.hook('host rig setup', hostRig.setup)

test('blind peer should download and sync core data seeded by another host instance', async function ({
  teardown,
  plan,
  is,
  execution
}) {
  plan(5)

  const host = new Helper(hostRig)
  teardown(() => shutdownAndGc(host, undefined, hostRig), { order: Infinity })
  await host.ready()

  const link = await Helper.touchLink(host)
  const coreKey = hid.normalize(hid.decode(link))

  const staging = host.stage({
    link,
    dir: Helper.fixture('versions'),
    dryRun: false
  })
  teardown(() => Helper.teardownStream(staging))
  const staged = await Helper.pick(staging, [{ tag: 'final' }])
  await staged.final

  const seedingHost = host.seed({ link })
  teardown(() => Helper.teardownStream(seedingHost))
  const seeded = await Helper.pick(seedingHost, [{ tag: 'announced' }, { tag: 'peer-add' }])
  await seeded.announced

  const client = new Helper(rig)
  teardown(() => shutdownAndGc(client), { order: Infinity })
  await client.ready()

  let clientPubKey
  {
    const clientIdentityStream = client.blindPeer({ subcommand: 'identity' })
    teardown(() => Helper.teardownStream(clientIdentityStream))
    const { final } = await Helper.pick(clientIdentityStream, [{ tag: 'final' }])
    clientPubKey = (await final).publicKey
    await Helper.teardownStream(clientIdentityStream)
  }

  const server = new Helper(rig)
  teardown(() => server.close(), { order: Infinity })
  await server.ready()

  const serverStream = server.blindPeer({
    subcommand: 'start',
    data: { trustedPeers: [clientPubKey] }
  })
  teardown(() => Helper.teardownStream(serverStream))
  const serverMsgs = await Helper.pick(serverStream, [
    { tag: 'listening' },
    { tag: 'add-core', data: { key: coreKey } },
    { tag: 'announce-core', data: { key: coreKey } },
    { tag: 'core-downloaded', data: { key: coreKey } }
  ])
  const { publicKey: peerKey } = await serverMsgs.listening

  const requestStream = client.blindPeer({
    subcommand: 'request',
    data: { key: coreKey, peerKey }
  })
  teardown(() => Helper.teardownStream(requestStream))

  const { final: seeding } = await Helper.pick(requestStream, [{ tag: 'final' }])

  await execution(serverMsgs['add-core'], 'server receives add-core request')
  await execution(serverMsgs['announce-core'], 'server announced core')
  await execution(seeding, 'client receives seeding confirmation')
  await execution(seeded['peer-add'], 'host receives peer-add on seed')
  const downloaded = await serverMsgs['core-downloaded']
  is(downloaded.key, coreKey, 'blind peer downloaded core data from host')
})

unhookHost('host rig cleanup', hostRig.cleanup)

test('blind peer should add an unseeded core when coreOnly is true', async function ({
  teardown,
  plan,
  is,
  ok,
  execution
}) {
  plan(5)

  const client = new Helper(rig)
  teardown(() => shutdownAndGc(client), { order: Infinity })
  await client.ready()

  let clientPubKey
  {
    const clientIdentityStream = client.blindPeer({ subcommand: 'identity' })
    teardown(() => Helper.teardownStream(clientIdentityStream))
    const { final } = await Helper.pick(clientIdentityStream, [{ tag: 'final' }])
    clientPubKey = (await final).publicKey
    await Helper.teardownStream(clientIdentityStream)
  }

  const unseededKey = hid.normalize(Helper.getRandomId())

  const server = new Helper(rig)
  teardown(() => server.close(), { order: Infinity })
  await server.ready()

  const serverStream = server.blindPeer({
    subcommand: 'start',
    data: { trustedPeers: [clientPubKey] }
  })
  teardown(() => Helper.teardownStream(serverStream))
  const serverMsgs = await Helper.pick(serverStream, [
    { tag: 'listening' },
    { tag: 'add-core', data: { key: unseededKey } },
    { tag: 'announce-core', data: { key: unseededKey } }
  ])
  const { publicKey: peerKey } = await serverMsgs.listening

  const requestStream = client.blindPeer({
    subcommand: 'request',
    data: { key: unseededKey, peerKey, coreOnly: true }
  })
  teardown(() => Helper.teardownStream(requestStream))

  const seeding = await Helper.pick(requestStream, { tag: 'final' })
  const seedingResult = await seeding

  await execution(serverMsgs['add-core'], 'server receives add-core request')
  await execution(serverMsgs['announce-core'], 'server announced unseeded core')
  ok(seedingResult.announce, 'core announced')
  is(seedingResult.key, unseededKey, 'core key matches')
  is(seedingResult.peerKey, peerKey, 'peer key matches')
})

test('blind peer request for unseeded drive should timeout waiting for blobs', async function ({
  teardown,
  plan,
  exception
}) {
  plan(1)

  const client = new Helper(rig)
  teardown(() => shutdownAndGc(client), { order: Infinity })
  await client.ready()

  let clientPubKey
  {
    const clientIdentityStream = client.blindPeer({ subcommand: 'identity' })
    teardown(() => Helper.teardownStream(clientIdentityStream))
    const { final } = await Helper.pick(clientIdentityStream, [{ tag: 'final' }])
    clientPubKey = (await final).publicKey
    await Helper.teardownStream(clientIdentityStream)
  }

  const unseededDriveKey = hid.normalize(Helper.getRandomId())

  const server = new Helper(rig)
  teardown(() => server.close(), { order: Infinity })
  await server.ready()

  const serverStream = server.blindPeer({
    subcommand: 'start',
    data: { trustedPeers: [clientPubKey] }
  })
  teardown(() => Helper.teardownStream(serverStream))
  const serverMsgs = await Helper.pick(serverStream, [{ tag: 'listening' }])
  const { publicKey: peerKey } = await serverMsgs.listening

  const requestStream = client.blindPeer({
    subcommand: 'request',
    data: { key: unseededDriveKey, peerKey, coreOnly: false }
  })
  teardown(() => Helper.teardownStream(requestStream))

  await exception(
    withTimeout(Helper.pick(requestStream, { tag: 'final' }), 3000),
    /Operation timed out/,
    'adding unseeded drive times out waiting for blobs'
  )
})

test('blind peer request should timeout if blind peer is unreachable', async function ({
  teardown,
  plan,
  exception
}) {
  plan(1)

  const client = new Helper(rig)
  teardown(() => shutdownAndGc(client), { order: Infinity })
  await client.ready()

  const unreachablePeerKey = hid.normalize(Helper.getRandomId())
  const coreKey = hid.normalize(Helper.getRandomId())

  const requestStream = client.blindPeer({
    subcommand: 'request',
    data: { key: coreKey, peerKey: unreachablePeerKey, coreOnly: true, timeout: 500 }
  })
  teardown(() => Helper.teardownStream(requestStream))

  await exception(
    Helper.pick(requestStream, { tag: 'final' }),
    /Timed out waiting for blind peer/,
    'request times out when blind peer is unreachable'
  )
})

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

    await shutdownAndGc(helper)
  }

  let identity2
  {
    const helper = new Helper(rig)
    teardown(() => shutdownAndGc(helper), { order: Infinity })
    await helper.ready()

    const identityStream = helper.blindPeer({ subcommand: 'identity' })
    teardown(() => Helper.teardownStream(identityStream))
    const { final } = await Helper.pick(identityStream, [{ tag: 'final' }])
    identity2 = (await final).publicKey
    await Helper.teardownStream(identityStream)
  }

  is(identity1, identity2, 'blind peer identity remains the same after restart')
})

unhookBlindPeer('blind peer rig cleanup', rig.cleanup)
