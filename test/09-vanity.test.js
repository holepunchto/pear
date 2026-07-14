'use strict'
const test = require('brittle')
const z32 = require('z32')
const Hypercore = require('hypercore')
const crypto = require('hypercore-crypto')
const HyperMultisig = require('hyper-multisig')
const hid = require('hypercore-id-encoding')
const findVanityKey = require('../lib/vanity.js')

function pearKey(publicKey) {
  return z32.encode(Hypercore.key({ signers: [{ publicKey }] }))
}

function generateMultisigConfig() {
  const kp1 = crypto.keyPair()
  const kp2 = crypto.keyPair()
  const kp3 = crypto.keyPair()
  return {
    publicKeys: [kp1.publicKey, kp2.publicKey, kp3.publicKey],
    namespace: 'test-namespace',
    quorum: 2
  }
}

function multisigKey(namespace, config) {
  return hid.normalize(
    HyperMultisig.getCoreKey(config.publicKeys, namespace, { quorum: config.quorum })
  )
}

test('touch vanity key should start with given two-char prefix', async ({ plan, ok }) => {
  plan(3)
  {
    const prefix = 'pe'
    const keyPair = await findVanityKey(prefix)
    const z = pearKey(keyPair.publicKey)
    ok(z.startsWith(prefix), `z32 key starts with '${prefix}'`)
  }

  {
    const prefix = 'ea'
    const keyPair = await findVanityKey(prefix)
    const z = pearKey(keyPair.publicKey)
    ok(z.startsWith(prefix), `z32 key starts with '${prefix}'`)
  }

  {
    const prefix = 'rs'
    const keyPair = await findVanityKey(prefix)
    const z = pearKey(keyPair.publicKey)
    ok(z.startsWith(prefix), `z32 key starts with '${prefix}'`)
  }
})

test('repeated calls to touch should return different keys', async ({ plan, not }) => {
  plan(2)
  const prefix = 'cd'
  const keyPair1 = await findVanityKey(prefix)
  const keyPair2 = await findVanityKey(prefix)

  not(keyPair1.publicKey.toString('hex'), keyPair2.publicKey.toString('hex'), 'publicKeys differ')
  not(keyPair1.secretKey.toString('hex'), keyPair2.secretKey.toString('hex'), 'secretKeys differ')
})

test('multisig vanity key should start with given two-char prefix', async ({ plan, ok }) => {
  plan(3)
  const config = generateMultisigConfig()

  {
    const prefix = 'pe'
    const namespace = await findVanityKey(prefix, 'multisig', config)
    ok(multisigKey(namespace, config).startsWith(prefix), `multisig key starts with '${prefix}'`)
  }

  {
    const prefix = 'ea'
    const namespace = await findVanityKey(prefix, 'multisig', config)
    ok(multisigKey(namespace, config).startsWith(prefix), `multisig key starts with '${prefix}'`)
  }

  {
    const prefix = 'rs'
    const namespace = await findVanityKey(prefix, 'multisig', config)
    ok(multisigKey(namespace, config).startsWith(prefix), `multisig key starts with '${prefix}'`)
  }
})

test('repeated multisig vanity calls should return different namespaces', async ({ plan, not }) => {
  plan(1)
  const prefix = 'ab'
  const config = generateMultisigConfig()

  const namespace1 = await findVanityKey(prefix, 'multisig', config)
  const namespace2 = await findVanityKey(prefix, 'multisig', config)

  not(namespace1, namespace2, 'namespaces should differ between calls')
})

test('multisig vanity should retain namespace if already matching', async ({ plan, is }) => {
  plan(1)
  const prefix = 'pe'
  const config = generateMultisigConfig()

  const namespace1 = await findVanityKey(prefix, 'multisig', config)
  config.namespace = namespace1
  const namespace2 = await findVanityKey(prefix, 'multisig', config)

  is(namespace1, namespace2, 'namespaces should remain the same')
})
