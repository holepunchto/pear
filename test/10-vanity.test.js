'use strict'
const test = require('brittle')
const z32 = require('z32')
const Hypercore = require('hypercore')
const findVanityKey = require('../lib/vanity.js')

function pearKey(publicKey) {
  return z32.encode(Hypercore.key({ signers: [{ publicKey }] }))
}

test('vanity key shoudl start with given two-char prefix', async ({ plan, ok }) => {
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

test('repeated calls should return different keys', async ({ plan, not }) => {
  plan(2)
  const prefix = 'cd'
  const keyPair1 = await findVanityKey(prefix)
  const keyPair2 = await findVanityKey(prefix)

  not(keyPair1.publicKey.toString('hex'), keyPair2.publicKey.toString('hex'), 'publicKeys differ')
  not(keyPair1.secretKey.toString('hex'), keyPair2.secretKey.toString('hex'), 'secretKeys differ')
})
