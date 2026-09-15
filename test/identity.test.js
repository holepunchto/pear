'use strict'
const test = require('brittle')
const hypercoreid = require('hypercore-id-encoding')
const Helper = require('./helper')

test('pear identity returns z32 identities', async function ({ teardown, plan, is }) {
  plan(6)

  const helper = new Helper()
  teardown(() => helper.close(), { order: Infinity })
  await helper.ready()

  let blindPeerIdentity
  let blindPeerClientIdentity
  for (const type of ['seed', 'blind-relay', 'blind-peer', 'blind-peer-client']) {
    const stream = helper.identity({ type })
    teardown(() => Helper.teardownStream(stream))
    const { final } = await Helper.pick(stream, [{ tag: 'final' }])
    const { publicKey } = await final
    is(publicKey, hypercoreid.normalize(publicKey), `${type} identity is z32`)
    if (type === 'blind-peer') blindPeerIdentity = publicKey
    if (type === 'blind-peer-client') blindPeerClientIdentity = publicKey
    await Helper.teardownStream(stream)
  }

  const clientIdentityStream = helper.identity()
  teardown(() => Helper.teardownStream(clientIdentityStream))
  const { final } = await Helper.pick(clientIdentityStream, [{ tag: 'final' }])
  is(blindPeerClientIdentity, (await final).publicKey, 'client identity matches DHT key')
  await Helper.teardownStream(clientIdentityStream)

  const startStream = helper.blindPeer({ subcommand: 'start' })
  teardown(() => Helper.teardownStream(startStream))
  const { listening } = await Helper.pick(startStream, [{ tag: 'listening' }])
  is(blindPeerIdentity, (await listening).publicKey, 'blind-peer identity matches listening key')
})
