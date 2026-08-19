'use strict'
const test = require('brittle')
const hid = require('hypercore-id-encoding')
const Helper = require('./helper')

const rig = new Helper.Rig({ keepAlive: false })
const unhookRig = test.hook('blind peer setup', rig.setup)

async function shutdownRigSidecar() {
  const rigHelper = new Helper(rig)
  await rigHelper.ready()
  await rigHelper.shutdown()

  // Give it time to fully shutdown
  await new Promise((resolve) => setTimeout(resolve, 1000))

  await rigHelper.close()
}

test('blind peer serves and untrusted client adds a core', async function ({
  teardown,
  plan,
  execution,
  absent
}) {
  plan(3)

  teardown(() => shutdownRigSidecar(), { order: Infinity })

  const server = new Helper(rig)
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

  teardown(() => shutdownRigSidecar(), { order: Infinity })

  const client = new Helper()
  teardown(() => client.close(), { order: Infinity })
  await client.ready()

  let clientPubKey
  {
    const clientIdentityStream = client.blindPeer({
      subcommand: 'request',
      data: { key: Helper.getRandomId(), peerKey: Helper.getRandomId() }
    })
    teardown(() => Helper.teardownStream(clientIdentityStream))
    const clientMsgs = await Helper.pick(clientIdentityStream, [{ tag: 'identity' }])
    clientPubKey = (await clientMsgs.identity).publicKey
    await Helper.teardownStream(clientIdentityStream)
  }

  const server = new Helper(rig)
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

unhookRig('blind peer cleanup', async (t) => {
  await rig.cleanup(t)
})
