'use strict'
const test = require('brittle')
const hypercoreid = require('hypercore-id-encoding')
const Helper = require('./helper')

test('pear identity returns z32 identities', async function ({ teardown, plan, is }) {
  plan(5)

  const helper = new Helper()
  teardown(() => helper.close(), { order: Infinity })
  await helper.ready()

  let blindPeerIdentity
  for (const type of ['seed', 'blind-relay', 'blind-peer', 'blind-peer-client']) {
    const identity = helper.identity({ type })
    teardown(() => Helper.teardownStream(identity))
    const { final } = await Helper.pick(identity, [{ tag: 'final' }])
    const { publicKey } = await final
    is(publicKey, hypercoreid.normalize(publicKey), `${type} identity is z32`)
    if (type === 'blind-peer') blindPeerIdentity = publicKey
    await Helper.teardownStream(identity)
  }

  const startStream = helper.blindPeer({ subcommand: 'start' })
  teardown(() => Helper.teardownStream(startStream))
  const { listening } = await Helper.pick(startStream, [{ tag: 'listening' }])
  is(blindPeerIdentity, (await listening).publicKey, 'blind-peer identity matches listening key')
})
